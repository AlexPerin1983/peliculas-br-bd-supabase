import { expect, test } from '@playwright/test';
import {
  expectLocatorInsideViewport,
  expectNoHorizontalOverflow,
} from './helpers/iphoneApp';

test.describe('experiência pública no iPhone', () => {
  test('usa WebKit móvel e viewport preparado para safe area', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Fazer Login' })).toBeVisible();

    const viewportContent = await page
      .locator('meta[name="viewport"]')
      .getAttribute('content');
    expect(viewportContent).toContain('viewport-fit=cover');
    expect(viewportContent).toContain('interactive-widget=resizes-content');
    await expect(
      page.locator('meta[name="apple-mobile-web-app-status-bar-style"]'),
    ).toHaveAttribute('content', 'black');

    const deviceSignals = await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      coarsePointer: window.matchMedia('(pointer: coarse)').matches,
      hasTouchEvent: 'ontouchstart' in window,
    }));
    expect(deviceSignals.userAgent).toContain('AppleWebKit');
    expect(deviceSignals.userAgent).toMatch(/Mobile|iPhone/);
    expect(deviceSignals.coarsePointer || deviceSignals.hasTouchEvent).toBe(true);
    await expectNoHorizontalOverflow(page);
  });

  test('mantém login utilizável quando a altura diminui como ao abrir o teclado', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const email = page.getByLabel('Email', { exact: true });
    const password = page.getByLabel('Senha', { exact: true });
    const submit = page.getByRole('button', { name: 'Entrar', exact: true });

    await email.tap();
    await email.fill('teste@peliculasbr.test');
    await expect(email).toBeFocused();

    const initialViewport = page.viewportSize();
    expect(initialViewport).not.toBeNull();
    if (!initialViewport) return;

    await page.setViewportSize({ width: initialViewport.width, height: 430 });
    await password.tap();
    await password.fill('senha-de-teste');
    await expect(password).toBeFocused();

    await submit.scrollIntoViewIfNeeded();
    await expectLocatorInsideViewport(submit);
    await expectNoHorizontalOverflow(page);
  });

  test('abre e fecha um modal público sem perder os controles no viewport', async ({ page }) => {
    await page.goto('/proposta?token=demo', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', { name: /Sua proposta está pronta/i }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Conversar com a empresa' }).tap();
    const dialog = page.getByRole('dialog', { name: 'Conversar com a empresa' });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: /Tenho uma dúvida/i }).tap();

    const message = page.getByPlaceholder('Escreva sua dúvida.');
    await message.tap();
    await message.fill('Teste de foco e teclado no WebKit');
    await expect(message).toBeFocused();
    await expectLocatorInsideViewport(message);
    await expectNoHorizontalOverflow(page);
  });
});
