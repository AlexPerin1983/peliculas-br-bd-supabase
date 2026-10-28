import { expect, test } from '@playwright/test';
import { type BlockedRequest, seedOfflineSession } from './helpers/iphoneApp';

test.describe('login sem internet no iPhone', () => {
  let blockedWrites: BlockedRequest[];

  test.afterEach(() => {
    expect(blockedWrites).toEqual([]);
  });

  test('login vencido sem internet para renovar continua na conta', async ({ page }) => {
    blockedWrites = await seedOfflineSession(page, { communityAccessGranted: true });

    // Login guardado já vencido (o app ficou fechado mais de 1 hora).
    await page.addInitScript(() => {
      const key = 'peliculas-br-bd-auth-v4';
      const stored = JSON.parse(window.localStorage.getItem(key) || '{}');
      stored.expires_at = Math.floor(Date.now() / 1000) - 60 * 60;
      window.localStorage.setItem(key, JSON.stringify(stored));
    });

    // Sem internet: a renovação do login falha como falha de rede.
    let refreshAttempts = 0;
    await page.route('**/auth/v1/token**', async (route) => {
      refreshAttempts += 1;
      await route.abort('internetdisconnected');
    });

    test.setTimeout(240_000);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => refreshAttempts).toBeGreaterThan(0);
    // O Supabase tenta renovar por uns 2 minutos; antes da correção, aí o app mostrava o login.
    await page.waitForTimeout(150_000);

    await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeVisible();
    await expect(page.getByText('Fazer Login')).toHaveCount(0);
  });
});
