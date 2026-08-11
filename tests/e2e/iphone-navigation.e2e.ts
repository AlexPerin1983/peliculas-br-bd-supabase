import { expect, test } from '@playwright/test';
import {
  type BlockedRequest,
  expectLocatorInsideViewport,
  expectNoHorizontalOverflow,
  seedOfflineSession,
} from './helpers/iphoneApp';

test.describe('navegação autenticada no iPhone', () => {
  let blockedWrites: BlockedRequest[];

  test.beforeEach(async ({ page }) => {
    blockedWrites = await seedOfflineSession(page, { communityAccessGranted: true });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeVisible();
  });

  test.afterEach(() => {
    expect(blockedWrites).toEqual([]);
  });

  test('menu hambúrguer abre por toque e permanece dentro do viewport', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: 'Abrir menu' });
    await expectLocatorInsideViewport(menuButton);
    await menuButton.tap();

    await expect(page.getByRole('dialog', { name: 'Menu principal' })).toBeVisible();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    await expectNoHorizontalOverflow(page);
  });

  test('botão voltar fica clicável depois de navegar pelo menu', async ({ page }) => {
    await page.getByRole('button', { name: 'Abrir menu' }).tap();
    const menu = page.getByRole('dialog', { name: 'Menu principal' });
    await menu.locator('[data-menu-tab="agenda"]').tap();

    const backButton = page.getByRole('button', { name: 'Voltar para a tela anterior' });
    await expectLocatorInsideViewport(backButton);
    await backButton.tap();
    await expect(backButton).toBeHidden();
  });

  test('voltar do seletor de clientes não fica coberto no topo', async ({ page }) => {
    await page.getByRole('button', { name: 'Abrir menu' }).tap();
    const menu = page.getByRole('dialog', { name: 'Menu principal' });
    await menu.locator('[data-menu-tab="client"]').tap();

    // O fixture começa sem clientes. Criamos um registro apenas no IndexedDB
    // descartável deste teste para chegar ao seletor sem tocar no Supabase.
    await page.getByRole('button', { name: 'Adicionar Cliente', exact: true }).tap();
    await page.getByLabel('Nome do Cliente').fill('Cliente E2E');
    await page.getByRole('button', { name: 'Salvar Cliente' }).tap();
    await page.getByRole('button', { name: 'Trocar de cliente' }).tap();

    const search = page.getByPlaceholder('Buscar pelo nome do cliente...');
    const backButton = page.getByRole('button', { name: 'Voltar', exact: true });
    await expect(search).toBeVisible();
    await expectLocatorInsideViewport(backButton);
    await backButton.tap();
    await expect(search).toBeHidden();
  });
});
