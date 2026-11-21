// @vitest-environment node
// Ações da equipe pelo WhatsApp: agenda_criar e proposta_*.
import { describe, expect, it, vi } from 'vitest';
import { handleCrmRead, type CrmKeyRecord, type CrmReadDeps } from '../../supabase/functions/crm-read/crmReadHandler';
import { sha256Hex } from '../../supabase/functions/crm-read/crmReadLogic';
import {
    describeWhen, parseLocalDateTime, parseTeamCommand, proposalPortalUrl,
} from '../../supabase/functions/crm-read/crmTeamLogic';

const NOW = Date.parse('2026-11-21T12:00:00-03:00');
const ORG = '11111111-1111-4111-8111-111111111111';
const KEY_ALL = `pbr_ro_${'a'.repeat(43)}`;
const KEY_READ = `pbr_ro_${'b'.repeat(43)}`;
const TEAM = '5583999990000';
const CLIENT = '5583988887777';

const buildDeps = async (rpcResult: (name: string, args: Record<string, unknown>) => any) => {
    const keys = new Map<string, CrmKeyRecord>([
        [await sha256Hex(KEY_ALL), { keyId: 'k1', organizationId: ORG, scopes: ['proposals:read', 'agenda:read', 'agenda:create', 'proposals:write', 'proposals:send'] }],
        [await sha256Hex(KEY_READ), { keyId: 'k2', organizationId: ORG, scopes: ['proposals:read', 'agenda:read'] }],
    ]);
    return {
        findKey: vi.fn(async (hash: string) => keys.get(hash) ?? null),
        loadProposals: vi.fn(),
        loadAgenda: vi.fn(async (_org: string, _from: string, _to: string): Promise<any> => ({
            events: [{ start: '2026-11-24T14:00:00-03:00', end: '2026-11-24T15:00:00-03:00' }],
            working_hours: { start: '08:00', end: '18:00', days: [1, 2, 3, 4, 5] },
        })),
        runTeamRpc: vi.fn(async (name: string, args: Record<string, unknown>) => rpcResult(name, args)),
        notifyCompany: vi.fn(async () => {}),
        now: () => NOW,
        logError: vi.fn(),
    } satisfies CrmReadDeps;
};

const call = (deps: CrmReadDeps, body: unknown, key = KEY_ALL) =>
    handleCrmRead(new Request('https://exemplo.test/functions/v1/crm-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-crm-key': key },
        body: JSON.stringify(body),
    }), deps);

describe('leitura dos comandos da equipe', () => {
    it('entende data e hora de Brasília', () => {
        expect(parseLocalDateTime('2026-11-24 14:00')).toBe(Date.parse('2026-11-24T17:00:00Z'));
        expect(parseLocalDateTime('2026-11-24T14:00')).toBe(Date.parse('2026-11-24T17:00:00Z'));
        expect(parseLocalDateTime('2026-11-24T17:00:00Z')).toBe(Date.parse('2026-11-24T17:00:00Z'));
        expect(parseLocalDateTime('2026-02-30 10:00')).toBeNull();
        expect(parseLocalDateTime('24/11 14h')).toBeNull();
        expect(describeWhen(Date.parse('2026-11-24T17:00:00Z'))).toBe('terça-feira (24/11) às 14:00');
    });

    it('exige o telefone de quem deu o comando nas escritas', () => {
        expect(parseTeamCommand('agenda_criar', { cliente_telefone: CLIENT, inicio: '2026-11-24 14:00' }))
            .toEqual({ invalid: expect.stringContaining('operador_telefone') });
        expect(parseTeamCommand('proposta_enviar', { cliente_telefone: CLIENT })).toHaveProperty('invalid');
        expect(parseTeamCommand('proposta_consultar', { cliente_telefone: CLIENT })).toMatchObject({ phone: CLIENT });
    });

    it('usa 60 minutos quando não vem o fim, e recusa valores fora do limite', () => {
        const command = parseTeamCommand('agenda_criar', { operador_telefone: TEAM, cliente_ref: 5, inicio: '2026-11-24 14:00', tipo: 'instalacao' });
        expect(command).toMatchObject({ clientId: 5, type: 'instalacao', end: Date.parse('2026-11-24T18:00:00Z') });
        expect(parseTeamCommand('agenda_criar', { operador_telefone: TEAM, cliente_ref: 5, inicio: '2026-11-24 14:00', duracao_minutos: 5 })).toHaveProperty('invalid');
        expect(parseTeamCommand('proposta_gerar', { operador_telefone: TEAM, cliente_ref: 5, desconto_percentual: 95 })).toHaveProperty('invalid');
        expect(parseTeamCommand('proposta_gerar', { operador_telefone: TEAM, cliente_ref: 5, peliculas: ['a', 'b', 'c', 'd', 'e'] })).toHaveProperty('invalid');
    });

    it('monta o link igual ao app', () => {
        expect(proposalPortalUrl('abc123', 'Márcia Lima')).toBe('https://app.filmstec.shop/p/marcia/abc123');
    });
});

describe('ações da equipe no CRM', () => {
    it('a empresa vem só da chave', async () => {
        const deps = await buildDeps(() => ({ ok: true }));
        const response = await call(deps, { action: 'proposta_consultar', cliente_telefone: CLIENT, company_id: 'outra' });
        expect(response.status).toBe(400);
        expect(deps.runTeamRpc).not.toHaveBeenCalled();
    });

    it('chave sem a permissão de escrita recebe 403', async () => {
        const deps = await buildDeps(() => ({ ok: true }));
        const response = await call(deps, { action: 'agenda_criar', operador_telefone: TEAM, cliente_telefone: CLIENT, inicio: '2026-11-24 14:00' }, KEY_READ);
        expect(response.status).toBe(403);
        expect(deps.runTeamRpc).not.toHaveBeenCalled();
    });

    it('número fora da equipe é recusado (o banco decide)', async () => {
        const deps = await buildDeps(() => { throw new Error('CRM:operador'); });
        const response = await call(deps, { action: 'proposta_enviar', operador_telefone: CLIENT, cliente_telefone: CLIENT });
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({ sucesso: false, motivo: 'operador_nao_autorizado' });
    });

    it('agenda: marca, avisa no celular e responde a frase pronta', async () => {
        const deps = await buildDeps(() => ({ ok: true, agenda_id: 77, client_id: 5, client_name: 'Marília', tipo: 'consulta' }));
        const response = await call(deps, { action: 'agenda_criar', operador_telefone: TEAM, cliente_telefone: CLIENT, inicio: '2026-11-24 14:00', tipo: 'visita_medicao' });
        expect(await response.json()).toMatchObject({ sucesso: true, agenda_id: 77, tipo: 'visita_medicao', mensagem: 'Agendado para terça-feira (24/11) às 14:00.' });
        expect(deps.runTeamRpc).toHaveBeenCalledWith('crm_agenda_create', expect.objectContaining({
            p_organization_id: ORG, p_key_id: 'k1', p_operator: TEAM, p_phone: CLIENT, p_type: 'consulta',
            p_start: '2026-11-24T17:00:00.000Z', p_end: '2026-11-24T18:00:00.000Z',
        }));
        expect(deps.notifyCompany).toHaveBeenCalledOnce();
    });

    it('agenda: horário ocupado devolve os horários livres próximos', async () => {
        const deps = await buildDeps(() => ({ ok: false, motivo: 'conflito' }));
        const body = await (await call(deps, { action: 'agenda_criar', operador_telefone: TEAM, cliente_telefone: CLIENT, inicio: '2026-11-24 14:00' })).json();
        expect(body).toMatchObject({ sucesso: false, motivo: 'conflito' });
        expect(body.livres[0]).toEqual({ inicio: '2026-11-24T08:00-03:00', fim: '2026-11-24T14:00-03:00' });
        expect(body.livres[1]).toEqual({ inicio: '2026-11-24T15:00-03:00', fim: '2026-11-24T18:00-03:00' });
        expect(deps.notifyCompany).not.toHaveBeenCalled();
    });

    it('proposta_gerar calcula sem enviar ao cliente', async () => {
        const opcoes = [{ nome: 'G5 (WhatsApp)', pelicula: 'G5', m2: 2.4, subtotal: 480, desconto: 48, total: 432, sem_preco: false }];
        const deps = await buildDeps(() => ({ ok: true, client_id: 5, client_name: 'Marília', opcoes }));
        const body = await (await call(deps, { action: 'proposta_gerar', operador_telefone: TEAM, cliente_telefone: CLIENT, peliculas: ['G5'], desconto_percentual: 10 })).json();
        expect(body).toMatchObject({ sucesso: true, enviado_ao_cliente: false, opcoes });
        expect(body).not.toHaveProperty('link_proposta');
        expect(deps.runTeamRpc).toHaveBeenCalledWith('crm_proposal_generate', expect.objectContaining({ p_films: ['G5'], p_discount_percent: 10 }));
    });

    it('proposta_gerar repassa película desconhecida com a lista do catálogo', async () => {
        const deps = await buildDeps(() => ({ ok: false, motivo: 'pelicula_desconhecida', desconhecidas: ['X9'], disponiveis: ['G5', 'Nano'] }));
        const body = await (await call(deps, { action: 'proposta_atualizar', operador_telefone: TEAM, cliente_ref: 5, peliculas: ['X9'] })).json();
        expect(body).toMatchObject({ sucesso: false, motivo: 'pelicula_desconhecida', peliculas_desconhecidas: ['X9'], peliculas_disponiveis: ['G5', 'Nano'] });
    });

    it('proposta_enviar devolve o link público', async () => {
        const deps = await buildDeps(() => ({ ok: true, client_id: 5, client_name: 'Marília Souza', token: 'tok', expira_em: '2026-11-28T23:59:59-03:00', opcoes: [] }));
        const body = await (await call(deps, { action: 'proposta_enviar', operador_telefone: TEAM, cliente_ref: 5 })).json();
        expect(body).toMatchObject({ sucesso: true, link_proposta: 'https://app.filmstec.shop/p/marilia/tok' });
        expect(deps.runTeamRpc).toHaveBeenCalledWith('crm_proposal_send', expect.objectContaining({ p_option_names: null, p_valid_days: 7 }));
    });

    it('erro inesperado do banco não vaza detalhes', async () => {
        const deps = await buildDeps(() => { throw new Error('relation "x" does not exist'); });
        const response = await call(deps, { action: 'proposta_consultar', cliente_ref: 5 });
        expect(response.status).toBe(503);
        expect(JSON.stringify(await response.json())).not.toContain('relation');
    });
});
