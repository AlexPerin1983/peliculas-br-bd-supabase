import { expect, test, type Page } from '@playwright/test';
import { type BlockedRequest, seedOfflineSession } from './helpers/iphoneApp';

// Link do aviso do WhatsApp (?tab=client&cliente=123): abre o cliente pedido ou
// avisa que não achou; nunca abre outro cliente no lugar.
test.describe('link do cliente', () => {
  let blockedWrites: BlockedRequest[];

  const seedClients = async (page: Page) => {
    await page.goto('/offline.html');
    await page.evaluate(async () => {
      const path = '/services/offlineDb.ts';
      const { offlineDb } = await import(/* @vite-ignore */ path);
      const row = (id: number, nome: string, lastUpdated: string) => ({
        id, nome, telefone: '(83) 90000-0000', email: '', cpfCnpj: '', lastUpdated,
        _localId: `remote_${id}`, _remoteId: id, _syncStatus: 'synced', _lastModified: Date.now(),
      });
      await offlineDb.clients.bulkPut([
        row(501, 'Outro Cliente', '2026-11-22T20:00:00Z'),
        row(502, 'Cliente Do Link', '2026-11-20T20:00:00Z'),
      ]);
    });
  };

  test.beforeEach(async ({ page }) => {
    blockedWrites = await seedOfflineSession(page, { communityAccessGranted: true });
    await seedClients(page);
  });

  test.afterEach(() => {
    expect(blockedWrites).toEqual([]);
  });

  test('abre direto o cliente do link, mesmo não sendo o mais recente', async ({ page }) => {
    await page.goto('/?tab=client&cliente=502', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Cliente Do Link').first()).toBeVisible();
    await expect(page.getByText('Outro Cliente')).toHaveCount(0);
    await expect(page).not.toHaveURL(/cliente=/);
  });

  test('cliente que não está na conta: avisa e não abre outro', async ({ page }) => {
    await page.goto('/?tab=client&cliente=2059', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Cliente não encontrado')).toBeVisible();
    await expect(page.getByText('Outro Cliente')).toHaveCount(0);
  });
});
