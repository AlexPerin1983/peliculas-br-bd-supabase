import { expect, test, type Page } from '@playwright/test';
import { type BlockedRequest, seedOfflineSession } from './helpers/iphoneApp';

// Versão aberta pelo app da Google Play: nada de plano, preço, selo premium ou
// pagamento. Prints opcionais em PLAY_STORE_SHOTS_DIR (antes/depois).
const PLAY_REFERRER = 'android-app://br.com.peliculasbr.app/';
const FLAG_KEY = 'pbr:play-store-app';
const shotsDir = process.env.PLAY_STORE_SHOTS_DIR;

const shot = async (page: Page, name: string) => {
  if (shotsDir) await page.screenshot({ path: `${shotsDir}/${name}.png`, fullPage: false });
};

const openTab = async (page: Page, tab: string) => {
  await page.getByRole('button', { name: 'Abrir menu' }).tap();
  await page.getByRole('dialog', { name: 'Menu principal' }).locator(`[data-menu-tab="${tab}"]`).tap();
  await expect(page.getByRole('dialog', { name: 'Menu principal' })).toBeHidden();
  await page.waitForTimeout(400);
};

const expectNoBillingText = async (page: Page) => {
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/R\$\s?\d/);
  expect(text).not.toMatch(/premium|meu plano|assinar|assinatura mensal|contratar|upgrade|pacote completo/i);
  expect(text).not.toMatch(/navegador|pelo site/i);
};

test.describe('app da Google Play sem planos nem pagamento', () => {
  let blockedWrites: BlockedRequest[];

  test.beforeEach(async ({ page }) => {
    blockedWrites = await seedOfflineSession(page, { communityAccessGranted: true });
  });

  test.afterEach(() => {
    // whatsapp_triage_list é uma leitura feita por POST (RPC); o helper a barra
    // como escrita e ela não chega ao Supabase. Qualquer outra é falha.
    const unexpected = blockedWrites.filter((request) => !request.url.endsWith('/rpc/whatsapp_triage_list'));
    expect(unexpected).toEqual([]);
  });

  test('ANTES: no navegador comum, Minha Conta e Estoque mostram a oferta', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await openTab(page, 'account');
    await expect(page.getByText('Meu Plano')).toBeVisible();
    await shot(page, 'antes-1-minha-conta');

    await openTab(page, 'estoque');
    await expect(page.getByText('Premium').first()).toBeVisible();
    await shot(page, 'antes-2-estoque');
  });

  test('DEPOIS: aberto pelo app da Play, grava a marca e esconde tudo', async ({ page }) => {
    // Simula a primeira abertura do TWA (referrer android-app://).
    await page.addInitScript((referrer) => {
      if (sessionStorage.getItem('e2e-referrer-used')) return;
      sessionStorage.setItem('e2e-referrer-used', '1');
      Object.defineProperty(Document.prototype, 'referrer', { configurable: true, get: () => referrer });
    }, PLAY_REFERRER);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), FLAG_KEY)).toBe('1');

    // Recarrega sem referrer: a marca gravada continua valendo.
    await page.reload({ waitUntil: 'domcontentloaded' });
    expect(await page.evaluate(() => document.referrer)).not.toContain('android-app');

    await openTab(page, 'account');
    await expect(page.getByText('Alterar senha')).toBeVisible();
    await expect(page.getByText('Meu Plano')).toHaveCount(0);
    await expectNoBillingText(page);
    await shot(page, 'depois-1-minha-conta');

    await openTab(page, 'estoque');
    await expect(page.getByText('Esta função não está disponível nesta versão.')).toBeVisible();
    await expectNoBillingText(page);
    await shot(page, 'depois-2-estoque');
  });

  test('DEPOIS: link de upgrade não abre tela de contratação', async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, '1'), FLAG_KEY);
    await page.goto('/?upgrade=estoque', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Alterar senha')).toBeVisible();
    await expectNoBillingText(page);
  });
});
