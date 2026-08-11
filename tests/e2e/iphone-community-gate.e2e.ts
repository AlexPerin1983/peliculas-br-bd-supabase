import { expect, test } from '@playwright/test';
import {
  type BlockedRequest,
  expectLocatorInsideViewport,
  expectNoHorizontalOverflow,
  seedOfflineSession,
} from './helpers/iphoneApp';

test.describe('liberação de acesso no iPhone', () => {
  let blockedWrites: BlockedRequest[];

  test.beforeEach(async ({ page }) => {
    blockedWrites = await seedOfflineSession(page, { communityAccessGranted: false });
  });

  test.afterEach(() => {
    expect(blockedWrites).toEqual([]);
  });

  test('modal do código acompanha uma altura semelhante à do teclado', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(/Aplicativo 100% gratuito/i)).toBeVisible();
    await page.getByRole('button', { name: /Já tenho o código/i }).tap();

    const dialog = page.getByRole('dialog', { name: /Digite o código de acesso/i });
    const codeInput = page.getByLabel('Código do grupo');
    const submit = page.getByRole('button', { name: 'Liberar meu acesso' });
    await expect(dialog).toBeVisible();
    await expect(codeInput).toBeFocused();

    const initialViewport = page.viewportSize();
    expect(initialViewport).not.toBeNull();
    if (!initialViewport) return;

    await page.setViewportSize({ width: initialViewport.width, height: 430 });
    await codeInput.fill('CODIGO-TESTE');
    await submit.scrollIntoViewIfNeeded();

    await expectLocatorInsideViewport(codeInput);
    await expectLocatorInsideViewport(submit);
    await expect(submit).toBeEnabled();
    await expectNoHorizontalOverflow(page);
  });
});
