import { expect, test } from '@playwright/test';
import { type BlockedRequest, expectNoHorizontalOverflow, seedOfflineSession } from './helpers/iphoneApp';

test.describe('busca de clientes pelo endereço no iPhone', () => {
  let blockedWrites: BlockedRequest[];

  test.beforeEach(async ({ page }) => {
    blockedWrites = await seedOfflineSession(page, { communityAccessGranted: true });
    // Clientes de demonstração só no IndexedDB descartável deste teste.
    await page.goto('/offline.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      const db = await import('/services/offlineDb.ts');
      await db.saveClientLocal({ nome: 'Maria Souza', telefone: '11987654321', email: '', cpfCnpj: '', cep: '01310-100', logradouro: 'Avenida Paulista', numero: '1000', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP' });
      await db.saveClientLocal({ nome: 'João Lima', telefone: '11912345678', email: '', cpfCnpj: '', cep: '04500-000', logradouro: 'Rua das Flores', numero: '20', bairro: 'Moema', cidade: 'São Paulo', uf: 'SP' });
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeVisible();
  });

  test.afterEach(() => {
    // whatsapp_triage_list é uma leitura feita por POST que o fixture já recusa hoje (nada é gravado).
    expect(blockedWrites.filter(request => !request.url.includes('/rpc/whatsapp_triage_list'))).toEqual([]);
  });

  test('acha o cliente pelo bairro e pelo CEP e mostra onde ele mora', async ({ page }) => {
    await page.getByRole('button', { name: 'Abrir menu' }).tap();
    await page.getByRole('dialog', { name: 'Menu principal' }).locator('[data-menu-tab="clients_list"]').tap();

    const search = page.getByPlaceholder('Buscar por nome, telefone, bairro ou CEP');
    await expect(page.getByText('João Lima')).toBeVisible();

    await search.fill('bela vista');
    await expect(page.getByText('Maria Souza')).toBeVisible();
    await expect(page.getByText('João Lima')).toBeHidden();
    await expect(page.getByText('· Bela Vista · São Paulo')).toBeVisible();

    await search.fill('04500000');
    await expect(page.getByText('João Lima')).toBeVisible();
    await expect(page.getByText('Maria Souza')).toBeHidden();
    await expectNoHorizontalOverflow(page);
  });
});
