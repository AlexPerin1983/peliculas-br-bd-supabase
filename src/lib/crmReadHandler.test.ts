// @vitest-environment node
// Testes de acesso da leitura do CRM com um banco de mentira de DUAS empresas.
// O banco de mentira separa os dados pela empresa recebida, como as funções SQL
// crm_read_proposals / crm_read_agenda; o que se testa aqui é que a empresa usada
// é sempre a da chave, nunca a do pedido.
import { describe, expect, it, vi } from 'vitest';
import { handleCrmRead, type CrmKeyRecord, type CrmReadDeps } from '../../supabase/functions/crm-read/crmReadHandler';
import { sha256Hex, type ProposalRows } from '../../supabase/functions/crm-read/crmReadLogic';

const NOW = Date.parse('2026-11-20T12:00:00-03:00');
const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const KEY_A = `pbr_ro_${'a'.repeat(43)}`;
const KEY_B = `pbr_ro_${'b'.repeat(43)}`;
const KEY_AGENDA_ONLY = `pbr_ro_${'c'.repeat(43)}`;
const KEY_REVOKED = `pbr_ro_${'d'.repeat(43)}`;
const PHONE_A = '5521998765432';
const PHONE_B = '5511912345678';

const tenants: Record<string, { phone: string; rows: ProposalRows }> = {
    [ORG_A]: {
        phone: PHONE_A,
        rows: {
            clients: [{ id: 1, nome: 'Ana Empresa A' }],
            portals: [], items: [],
            pdfs: [{ id: 10, client_id: 1, total_preco: 1000, proposal_option_name: 'Opção da empresa A', films: [] }],
        },
    },
    [ORG_B]: {
        phone: PHONE_B,
        rows: {
            clients: [{ id: 2, nome: 'Bruno Empresa B' }],
            portals: [], items: [],
            pdfs: [{ id: 20, client_id: 2, total_preco: 9999, proposal_option_name: 'Opção da empresa B', films: [] }],
        },
    },
};

const buildDeps = async () => {
    const keys = new Map<string, CrmKeyRecord>([
        [await sha256Hex(KEY_A), { keyId: 'k-a', organizationId: ORG_A, scopes: ['proposals:read', 'agenda:read'] }],
        [await sha256Hex(KEY_B), { keyId: 'k-b', organizationId: ORG_B, scopes: ['proposals:read', 'agenda:read'] }],
        [await sha256Hex(KEY_AGENDA_ONLY), { keyId: 'k-c', organizationId: ORG_A, scopes: ['agenda:read'] }],
        // KEY_REVOKED: a função do banco não devolve chave revogada, desligada ou vencida.
    ]);
    const empty: ProposalRows = { clients: [], portals: [], items: [], pdfs: [] };
    const deps = {
        findKey: vi.fn(async (hash: string) => keys.get(hash) ?? null),
        loadProposals: vi.fn(async (org: string, phone: string) => (tenants[org]?.phone === phone ? tenants[org].rows : empty)),
        loadAgenda: vi.fn(async (_org: string) => ({ events: [], working_hours: { start: '08:00', end: '18:00', days: [1, 2, 3, 4, 5] } })),
        now: () => NOW,
        logError: vi.fn(),
    } satisfies CrmReadDeps;
    return deps;
};

const call = (deps: CrmReadDeps, body: unknown, key: string | null = KEY_A, method = 'POST') =>
    handleCrmRead(new Request('https://exemplo.test/functions/v1/crm-read', {
        method,
        headers: { 'Content-Type': 'application/json', ...(key ? { 'x-crm-key': key } : {}) },
        body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    }), deps);

describe('leitura do CRM: acesso autorizado', () => {
    it('chave da empresa A lê as propostas do cliente da empresa A', async () => {
        const deps = await buildDeps();
        const response = await call(deps, { action: 'propostas', telefone: '(21) 99876-5432' });
        expect(response.status).toBe(200);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        const body = await response.json();
        expect(body.encontrado).toBe(true);
        expect(body.clientes).toEqual([{ ref: 1, primeiro_nome: 'Ana', bairro: null, cidade: null }]);
        expect(body.propostas[0].opcoes[0].nome).toBe('Opção da empresa A');
        expect(deps.loadProposals).toHaveBeenCalledWith(ORG_A, PHONE_A);
    });

    it('chave da empresa A lê a agenda da empresa A', async () => {
        const deps = await buildDeps();
        const response = await call(deps, { action: 'agenda', de: '2026-11-23', ate: '2026-11-23' });
        expect(response.status).toBe(200);
        expect(deps.loadAgenda).toHaveBeenCalledWith(ORG_A, '2026-11-23T03:00:00.000Z', '2026-11-24T03:00:00.000Z');
        const body = await response.json();
        expect(body.livres).toEqual([{ inicio: '2026-11-23T08:00-03:00', fim: '2026-11-23T18:00-03:00' }]);
    });
});

describe('leitura do CRM: credencial inválida', () => {
    it.each([
        ['sem chave', null],
        ['chave no formato errado', 'abc'],
        ['chave que não existe', `pbr_ro_${'z'.repeat(43)}`],
        ['chave revogada ou desligada', KEY_REVOKED],
    ])('%s: 401 e nada é lido', async (_label, key) => {
        const deps = await buildDeps();
        const response = await call(deps, { action: 'propostas', telefone: PHONE_A }, key);
        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ error: 'Chave de acesso ausente ou inválida.' });
        expect(deps.loadProposals).not.toHaveBeenCalled();
        expect(deps.loadAgenda).not.toHaveBeenCalled();
    });

    it('chave sem permissão para propostas: 403', async () => {
        const deps = await buildDeps();
        const response = await call(deps, { action: 'propostas', telefone: PHONE_A }, KEY_AGENDA_ONLY);
        expect(response.status).toBe(403);
        expect(deps.loadProposals).not.toHaveBeenCalled();
    });

    it('banco fora do ar na conferência da chave: 503, sem detalhes', async () => {
        const deps = await buildDeps();
        deps.findKey.mockRejectedValueOnce(new Error('connection refused at db.interno:5432'));
        const response = await call(deps, { action: 'propostas', telefone: PHONE_A });
        expect(response.status).toBe(503);
        expect(JSON.stringify(await response.json())).not.toContain('db.interno');
        expect(deps.logError).toHaveBeenCalledWith('key_lookup_failed');
    });

    it('só aceita POST', async () => {
        const deps = await buildDeps();
        expect((await call(deps, null, KEY_A, 'GET')).status).toBe(405);
    });
});

describe('leitura do CRM: tentativa de consultar outra empresa', () => {
    it('chave da empresa A com o telefone de um cliente da empresa B: nada encontrado', async () => {
        const deps = await buildDeps();
        const response = await call(deps, { action: 'propostas', telefone: PHONE_B });
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toEqual({ encontrado: false, clientes: [], propostas: [], avisos: [] });
        expect(deps.loadProposals).toHaveBeenCalledWith(ORG_A, PHONE_B);
        expect(JSON.stringify(body)).not.toContain('Bruno');
    });

    it.each(['company_id', 'organization_id', 'organizationId', 'empresa_id'])(
        'chave da empresa A pedindo %s da empresa B: recusado antes de ler', async (field) => {
            const deps = await buildDeps();
            const response = await call(deps, { action: 'propostas', telefone: PHONE_B, [field]: ORG_B });
            expect(response.status).toBe(400);
            expect((await response.json()).error).toContain('A empresa vem da chave');
            expect(deps.loadProposals).not.toHaveBeenCalled();
        },
    );

    it('a empresa B continua vendo só os próprios dados com a própria chave', async () => {
        const deps = await buildDeps();
        const own = await (await call(deps, { action: 'propostas', telefone: PHONE_B }, KEY_B)).json();
        expect(own.clientes).toEqual([{ ref: 2, primeiro_nome: 'Bruno', bairro: null, cidade: null }]);
        const other = await (await call(deps, { action: 'propostas', telefone: PHONE_A }, KEY_B)).json();
        expect(other.encontrado).toBe(false);
        expect(deps.loadProposals).toHaveBeenNthCalledWith(1, ORG_B, PHONE_B);
        expect(deps.loadProposals).toHaveBeenNthCalledWith(2, ORG_B, PHONE_A);
    });

    it('a agenda também usa sempre a empresa da chave', async () => {
        const deps = await buildDeps();
        await call(deps, { action: 'agenda', de: '2026-11-23', ate: '2026-11-24' }, KEY_B);
        expect(deps.loadAgenda.mock.calls[0][0]).toBe(ORG_B);
        const refused = await call(deps, { action: 'agenda', de: '2026-11-23', ate: '2026-11-24', organization_id: ORG_A }, KEY_B);
        expect(refused.status).toBe(400);
        expect(deps.loadAgenda).toHaveBeenCalledTimes(1);
    });
});

describe('leitura do CRM: pedidos estranhos e registros', () => {
    it('recusa ações de escrita, JSON quebrado e pedido grande demais', async () => {
        const deps = await buildDeps();
        expect((await call(deps, { action: 'client_create', name: 'x', phone: PHONE_A })).status).toBe(400);
        expect((await call(deps, '{"action": "propostas"')).status).toBe(400);
        expect((await call(deps, { action: 'propostas', telefone: PHONE_A, pad: 'x'.repeat(5000) })).status).toBe(413);
        expect(deps.loadProposals).not.toHaveBeenCalled();
    });

    it('erro na consulta: 503 e o registro leva só o código, sem chave nem telefone', async () => {
        const deps = await buildDeps();
        deps.loadProposals.mockRejectedValueOnce(new Error(`falhou para ${PHONE_A}`));
        const response = await call(deps, { action: 'propostas', telefone: PHONE_A });
        expect(response.status).toBe(503);
        expect(deps.logError).toHaveBeenCalledWith('propostas_failed');
        const logged = JSON.stringify(deps.logError.mock.calls);
        expect(logged).not.toContain(PHONE_A);
        expect(logged).not.toContain(KEY_A);
    });
});
