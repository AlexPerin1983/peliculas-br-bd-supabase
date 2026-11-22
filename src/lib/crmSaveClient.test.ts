// @vitest-environment node
// Salvar cliente pelo atendimento de WhatsApp: nome limpo, permissão própria,
// sem duplicar, sem alterar cliente existente, empresa sempre a da chave.
import { describe, expect, it, vi } from 'vitest';
import { handleCrmRead, type CrmKeyRecord, type CrmReadDeps, type SaveClientOutcome } from '../../supabase/functions/crm-read/crmReadHandler';
import {
    cleanClientName, clientNotes, parseCrmCommand, provisionalClientName, requiredScope, saveClientPush, sha256Hex,
} from '../../supabase/functions/crm-read/crmReadLogic';

const NOW = Date.parse('2026-11-20T16:40:00-03:00');
const ORG_A = '11111111-1111-4111-8111-111111111111';
const KEY_SAVE = `pbr_ro_${'s'.repeat(43)}`;
const KEY_READ_ONLY = `pbr_ro_${'r'.repeat(43)}`;

describe('nome do cliente', () => {
    it('tira emojis e enfeites e mantém o nome', () => {
        expect(cleanClientName('Roseanny Nascimento✨🌸')).toBe('Roseanny Nascimento');
        expect(cleanClientName('  Dr   Flavio ')).toBe('Dr Flavio');
        expect(cleanClientName('M. CÉSAR')).toBe('M CÉSAR');
        expect(cleanClientName('Elen Diana Treinadora')).toBe('Elen Diana Treinadora');
        expect(cleanClientName("Ana D'Ávila-Souza")).toBe("Ana D'Ávila-Souza");
        // Letras "decoradas" do WhatsApp viram letras normais.
        expect(cleanClientName('𝓡𝓸𝓼𝓮 𝓢𝓲𝓵𝓿𝓪')).toBe('Rose Silva');
    });

    it('recusa o que não serve como nome', () => {
        expect(cleanClientName('♠❤♣♦')).toBeNull();
        expect(cleanClientName('🤍')).toBeNull();
        expect(cleanClientName('s.a')).toBeNull();
        expect(cleanClientName('A B')).toBeNull();
        expect(cleanClientName('')).toBeNull();
        expect(cleanClientName(42)).toBeNull();
    });

    it('nome provisório com o final do telefone', () => {
        expect(provisionalClientName('558398141069')).toBe('Cliente WhatsApp final 1069');
    });

    it('observação com a data de Brasília e o resumo', () => {
        expect(clientNotes('2 janelas, 1,73 × 1,25, quer claridade.', NOW))
            .toBe('Veio do WhatsApp (IA) em 20/11/2026: 2 janelas, 1,73 × 1,25, quer claridade.');
        // 23h30 em Brasília ainda é o mesmo dia.
        expect(clientNotes(null, Date.parse('2026-11-20T23:30:00-03:00'))).toBe('Veio do WhatsApp (IA) em 20/11/2026.');
    });
});

describe('pedido de salvar cliente', () => {
    it('lê telefone, nome, bairro e resumo', () => {
        expect(parseCrmCommand({
            action: 'cliente_salvar', telefone: '+55 (83) 9814-1069', nome: 'Roseanny ✨', bairro: ' Bessa ', resumo: '2 janelas',
        })).toEqual({
            action: 'cliente_salvar', phone: '558398141069', name: 'Roseanny', bairro: 'Bessa', cidade: null, summary: '2 janelas', measurements: [], film: null,
        });
        expect(requiredScope({ action: 'cliente_salvar', phone: '558398141069', name: null, bairro: null, cidade: null, summary: null, measurements: [], film: null }))
            .toBe('clients:create');
    });

    it('recusa campo de empresa, campo desconhecido, telefone ruim e resumo enorme', () => {
        expect(parseCrmCommand({ action: 'cliente_salvar', telefone: '83981411069', organization_id: ORG_A })).toHaveProperty('invalid');
        expect(parseCrmCommand({ action: 'cliente_salvar', telefone: '83981411069', email: 'x@y.z' })).toHaveProperty('invalid');
        expect(parseCrmCommand({ action: 'cliente_salvar', telefone: '123', nome: 'Ana' })).toHaveProperty('invalid');
        expect(parseCrmCommand({ action: 'cliente_salvar', telefone: '83981411069', nome: { first: 'Ana' } })).toHaveProperty('invalid');
        expect(parseCrmCommand({ action: 'cliente_salvar', telefone: '83981411069', resumo: 'x'.repeat(801) })).toHaveProperty('invalid');
    });

    it('aviso no celular: novo cliente ou pedido de novo', () => {
        expect(saveClientPush({ clientId: 7, name: 'Roseanny', created: true }, 'Bessa')).toEqual({
            title: 'Novo cliente pronto para orçamento', body: 'Roseanny (Bessa), pelo WhatsApp.', tag: 'crm-client-7', url: '/?tab=client&cliente=7',
        });
        expect(saveClientPush({ clientId: 7, name: 'Roseanny Souza', created: false }, null).title).toBe('Cliente pediu orçamento de novo');
    });
});

const buildDeps = async (existingPhones: string[] = []) => {
    const keys = new Map<string, CrmKeyRecord>([
        [await sha256Hex(KEY_SAVE), { keyId: 'k-save', organizationId: ORG_A, scopes: ['proposals:read', 'agenda:read', 'clients:create'] }],
        [await sha256Hex(KEY_READ_ONLY), { keyId: 'k-read', organizationId: ORG_A, scopes: ['proposals:read', 'agenda:read'] }],
    ]);
    const saved: Array<{ keyId: string; org: string; input: any }> = [];
    const deps = {
        findKey: vi.fn(async (hash: string) => keys.get(hash) ?? null),
        loadProposals: vi.fn(),
        loadAgenda: vi.fn(),
        saveClient: vi.fn(async (keyId: string, org: string, input: any): Promise<SaveClientOutcome> => {
            saved.push({ keyId, org, input });
            if (existingPhones.includes(input.phone)) return { ok: true, clientId: 50, name: 'Nome Antigo Do Cadastro', created: false };
            return { ok: true, clientId: 99, name: input.name, created: true };
        }),
        notifyCompany: vi.fn(async () => {}),
        now: () => NOW,
        logError: vi.fn(),
    } satisfies CrmReadDeps;
    return { deps, saved };
};

const call = (deps: CrmReadDeps, body: unknown, key = KEY_SAVE) =>
    handleCrmRead(new Request('https://exemplo.test/functions/v1/crm-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-crm-key': key },
        body: JSON.stringify(body),
    }), deps);

describe('salvar cliente: acesso', () => {
    it('chave só de leitura não salva (403)', async () => {
        const { deps } = await buildDeps();
        const response = await call(deps, { action: 'cliente_salvar', telefone: '83981411069', nome: 'Ana Lima' }, KEY_READ_ONLY);
        expect(response.status).toBe(403);
        expect(deps.saveClient).not.toHaveBeenCalled();
        expect(deps.notifyCompany).not.toHaveBeenCalled();
    });

    it('cria com o nome limpo, a empresa e a chave do servidor, e avisa no celular', async () => {
        const { deps, saved } = await buildDeps();
        const response = await call(deps, {
            action: 'cliente_salvar', telefone: '83981411069', nome: 'Roseanny Nascimento✨🌸', bairro: 'Bessa',
            resumo: '2 janelas, 1,73 × 1,25, quer claridade. Anúncio: Conforto sem perder a luz.',
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ cliente_ref: 99, criado: true, nome_salvo: 'Roseanny Nascimento', nome_provisorio: false, rascunho_medidas: 'sem_medidas' });
        expect(saved).toEqual([{
            keyId: 'k-save',
            org: ORG_A,
            input: {
                phone: '5583981411069', name: 'Roseanny Nascimento', bairro: 'Bessa', cidade: null, measurements: [], film: null,
                notes: 'Veio do WhatsApp (IA) em 20/11/2026: 2 janelas, 1,73 × 1,25, quer claridade. Anúncio: Conforto sem perder a luz.',
            },
        }]);
        expect(deps.notifyCompany).toHaveBeenCalledWith(ORG_A, expect.objectContaining({
            title: 'Novo cliente pronto para orçamento', body: 'Roseanny Nascimento (Bessa), pelo WhatsApp.',
        }));
    });

    it('nome só com emoji: salva com nome provisório e avisa', async () => {
        const { deps, saved } = await buildDeps();
        const body = await (await call(deps, { action: 'cliente_salvar', telefone: '558398141069', nome: '♠❤♣♦' })).json();
        expect(saved[0].input.name).toBe('Cliente WhatsApp final 1069');
        expect(body).toMatchObject({ criado: true, nome_provisorio: true, nome_salvo: 'Cliente WhatsApp final 1069' });
    });

    it('telefone que já é cliente: não cria e não devolve o nome do cadastro', async () => {
        const { deps } = await buildDeps(['5583981411069']);
        const body = await (await call(deps, { action: 'cliente_salvar', telefone: '83981411069', nome: 'Outro Nome' })).json();
        expect(body).toEqual({ cliente_ref: 50, criado: false, nome_salvo: null, nome_provisorio: false, rascunho_medidas: 'sem_medidas' });
        expect(deps.notifyCompany).toHaveBeenCalledWith(ORG_A, expect.objectContaining({ title: 'Cliente pediu orçamento de novo' }));
    });

    it('limite por hora: 429, sem aviso', async () => {
        const { deps } = await buildDeps();
        deps.saveClient.mockResolvedValueOnce({ ok: false, reason: 'limit' });
        const response = await call(deps, { action: 'cliente_salvar', telefone: '83981411069', nome: 'Ana Lima' });
        expect(response.status).toBe(429);
        expect(deps.notifyCompany).not.toHaveBeenCalled();
    });

    it('aviso no celular falhou: o cadastro vale e o registro leva só o código', async () => {
        const { deps } = await buildDeps();
        deps.notifyCompany.mockRejectedValueOnce(new Error('push 5583981411069'));
        const response = await call(deps, { action: 'cliente_salvar', telefone: '83981411069', nome: 'Ana Lima' });
        expect(response.status).toBe(200);
        expect(deps.logError).toHaveBeenCalledWith('notify_failed');
        expect(JSON.stringify(deps.logError.mock.calls)).not.toContain('5583981411069');
    });

    it('pedido com company_id: recusado antes de salvar', async () => {
        const { deps } = await buildDeps();
        const response = await call(deps, { action: 'cliente_salvar', telefone: '83981411069', nome: 'Ana Lima', company_id: 'outra' });
        expect(response.status).toBe(400);
        expect(deps.saveClient).not.toHaveBeenCalled();
    });

    it('erro no banco: 503 sem detalhes', async () => {
        const { deps } = await buildDeps();
        deps.saveClient.mockRejectedValueOnce(new Error('duplicate key at db.interno'));
        const response = await call(deps, { action: 'cliente_salvar', telefone: '83981411069', nome: 'Ana Lima' });
        expect(response.status).toBe(503);
        expect(JSON.stringify(await response.json())).not.toContain('db.interno');
        expect(deps.logError).toHaveBeenCalledWith('cliente_salvar_failed');
    });
});

describe('rascunho de medidas', () => {
    it('lê medidas em metros ou centímetros no formato do app', async () => {
        const { draftDimension } = await import('../../supabase/functions/crm-read/crmReadLogic');
        expect(draftDimension('5')).toBe('5,00');
        expect(draftDimension('1,2')).toBe('1,20');
        expect(draftDimension(1.735)).toBe('1,74');
        expect(draftDimension('120')).toBe('1,20');
        expect(draftDimension('0,01')).toBeNull();
        expect(draftDimension('25 metros')).toBeNull();
        expect(draftDimension('3000')).toBeNull();
    });

    it('aceita a lista de medidas da conversa e recusa lixo', () => {
        expect(parseCrmCommand({
            action: 'cliente_salvar', telefone: '61981195695', nome: 'Marilia', bairro: 'Cabo Branco',
            medidas: [{ largura: '5', altura: '2', local: 'Cortina de vidro' }, { largura: 3, altura: 2 }], pelicula: 'Nano Cerâmica',
        })).toMatchObject({
            measurements: [
                { largura: '5,00', altura: '2,00', quantidade: 1, ambiente: 'Cortina de vidro' },
                { largura: '3,00', altura: '2,00', quantidade: 1, ambiente: null },
            ],
            film: 'Nano Cerâmica',
        });
        expect(parseCrmCommand({ action: 'cliente_salvar', telefone: '61981195695', medidas: 'grande' })).toHaveProperty('invalid');
        expect(parseCrmCommand({ action: 'cliente_salvar', telefone: '61981195695', medidas: [{ largura: 'x', altura: 2 }] })).toHaveProperty('invalid');
        expect(parseCrmCommand({ action: 'cliente_salvar', telefone: '61981195695', medidas: [{ largura: 1, altura: 1, quantidade: 0 }] })).toHaveProperty('invalid');
        expect(parseCrmCommand({ action: 'cliente_salvar', telefone: '61981195695', medidas: Array(31).fill({ largura: 1, altura: 1 }) })).toHaveProperty('invalid');
    });

    it('manda as medidas para o banco e devolve se o rascunho foi criado', async () => {
        const { deps, saved } = await buildDeps();
        deps.saveClient.mockImplementationOnce(async (_k: string, _o: string, input: any) => {
            saved.push({ keyId: _k, org: _o, input });
            return { ok: true, clientId: 99, name: input.name, created: true, draft: 'criado' };
        });
        const body = await (await call(deps, {
            action: 'cliente_salvar', telefone: '61981195695', nome: 'Marilia',
            medidas: [{ largura: 5, altura: 2 }], pelicula: 'Nano Cerâmica',
        })).json();
        expect(saved[0].input.measurements).toEqual([{ largura: '5,00', altura: '2,00', quantidade: 1, ambiente: null }]);
        expect(saved[0].input.film).toBe('Nano Cerâmica');
        expect(body.rascunho_medidas).toBe('criado');
    });
});
