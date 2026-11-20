// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
    agendaRange, freeSlots, isPlausibleCrmKey, localIso, normalizeWorkingHours, parseCrmCommand, phoneDigits,
    requiredScope, shapeAgenda, shapeProposals, type ProposalRows,
} from '../../supabase/functions/crm-read/crmReadLogic';

// Sexta, 20/11/2026, meio-dia em Brasília.
const NOW = Date.parse('2026-11-20T12:00:00-03:00');
const KEY = `pbr_ro_${'A'.repeat(43)}`;

describe('leitura do CRM: pedido', () => {
    it('aceita só chaves de leitura no formato certo', () => {
        expect(isPlausibleCrmKey(KEY)).toBe(true);
        expect(isPlausibleCrmKey(`pbr_ro_${'a'.repeat(42)}`)).toBe(false);
        expect(isPlausibleCrmKey('a'.repeat(64))).toBe(false); // chave da ponte do WhatsApp não serve
        expect(isPlausibleCrmKey(`${KEY}' OR 1=1`)).toBe(false);
        expect(isPlausibleCrmKey(null)).toBe(false);
    });

    it('normaliza o telefone igual ao banco', () => {
        expect(phoneDigits('(21) 99876-5432')).toBe('5521998765432');
        expect(phoneDigits('5521998765432')).toBe('5521998765432');
        expect(phoneDigits('021 3333-4444')).toBe('552133334444');
        expect(phoneDigits('123')).toBeNull();
        expect(phoneDigits({ telefone: '21998765432' })).toBeNull();
    });

    it('recusa qualquer campo que tente escolher a empresa', () => {
        for (const field of ['company_id', 'organization_id', 'organizationId', 'empresa_id', 'tenant', 'org']) {
            const result = parseCrmCommand({ action: 'propostas', telefone: '21998765432', [field]: 'outra' });
            expect(result).toHaveProperty('invalid');
            expect((result as { invalid: string }).invalid).toContain('A empresa vem da chave');
        }
    });

    it('recusa campos desconhecidos e ações que não são de leitura', () => {
        expect(parseCrmCommand({ action: 'propostas', telefone: '21998765432', proposal_id: 7 })).toHaveProperty('invalid');
        expect(parseCrmCommand({ action: 'agendar', de: '2026-11-23', ate: '2026-11-23' })).toHaveProperty('invalid');
        expect(parseCrmCommand({ action: 'client_create', name: 'x', phone: '21998765432' })).toHaveProperty('invalid');
        expect(parseCrmCommand(null)).toHaveProperty('invalid');
        expect(parseCrmCommand([])).toHaveProperty('invalid');
    });

    it('lê propostas por telefone', () => {
        const command = parseCrmCommand({ action: 'propostas', telefone: '21 99876-5432' });
        expect(command).toEqual({ action: 'propostas', phone: '5521998765432' });
        expect(requiredScope(command as any)).toBe('proposals:read');
    });

    it('lê a agenda com datas válidas e no máximo 31 dias', () => {
        expect(parseCrmCommand({ action: 'agenda', de: '2026-11-23', ate: '2026-11-30' })).toEqual({ action: 'agenda', from: '2026-11-23', to: '2026-11-30' });
        expect(parseCrmCommand({ action: 'agenda', de: '2026-11-01', ate: '2026-12-01' })).toEqual({ action: 'agenda', from: '2026-11-01', to: '2026-12-01' });
        expect(parseCrmCommand({ action: 'agenda', de: '2026-11-01', ate: '2026-12-02' })).toHaveProperty('invalid');
        expect(parseCrmCommand({ action: 'agenda', de: '2026-11-30', ate: '2026-11-23' })).toHaveProperty('invalid');
        expect(parseCrmCommand({ action: 'agenda', de: '2026-02-30', ate: '2026-03-01' })).toHaveProperty('invalid');
        expect(parseCrmCommand({ action: 'agenda', de: '23/11/2026', ate: '2026-11-30' })).toHaveProperty('invalid');
        expect(requiredScope({ action: 'agenda', from: '2026-11-23', to: '2026-11-23' })).toBe('agenda:read');
    });

    it('converte o intervalo para o horário de Brasília', () => {
        expect(agendaRange('2026-11-23', '2026-11-24')).toEqual({
            fromIso: '2026-11-23T03:00:00.000Z',
            toIso: '2026-11-25T03:00:00.000Z',
        });
        expect(localIso(Date.parse('2026-11-23T13:00:00Z'))).toBe('2026-11-23T10:00-03:00');
    });
});

const proposalRows = (): ProposalRows => ({
    clients: [{ id: 101, nome: 'Maria Aparecida da Silva', bairro: ' Bessa ', cidade: 'João Pessoa', telefone: '21998765432', cpf: '123.456.789-00', logradouro: 'Rua Secreta, 45', cep: '58035-000' } as any],
    portals: [{
        id: 'portal-1', client_id: 101, status: 'active', created_at: '2026-11-18T13:00:00Z',
        expires_at: '2026-11-25T13:00:00Z', view_count: 3, last_viewed_at: '2026-11-19T22:10:00Z',
        decision_pdf_id: null, decision_at: null, lost_at: null, highlighted_pdf_id: 502, token: 'segredo-do-link',
    }],
    items: [
        { portal_id: 'portal-1', saved_pdf_id: 501, position: 0, condition_final_value: null },
        { portal_id: 'portal-1', saved_pdf_id: 502, position: 1, condition_original_value: 2400, condition_final_value: 2160, condition_discount_amount: 240, condition_discount_percent: 10, condition_expires_at: '2026-11-22T23:00:00Z' },
    ],
    pdfs: [
        {
            id: 501, client_id: 101, date: '2026-11-18T12:00:00Z', expiration_date: '2026-11-25T12:00:00Z', status: 'pending',
            proposal_option_name: 'Opção econômica', total_preco: 1500, total_m2: 12.5, follow_up_revision: 0,
            films: ['Fumê G20'], payment_config: { paymentMethods: [{ tipo: 'pix', ativo: true, porcentagem: 5 }], prazoPagamento: '50% na aprovação' },
            pdf_path: 'privado/arquivo.pdf', observation: 'cliente chato',
        },
        {
            id: 502, client_id: 101, date: '2026-11-18T12:00:00Z', expiration_date: '2026-11-25T12:00:00Z', status: 'pending',
            proposal_option_name: 'Nano cerâmica', total_preco: 2400, total_m2: 12.5, follow_up_revision: 0,
            films: ['Nano Cerâmica 35'], payment_config: null,
        },
        {
            id: 480, client_id: 101, date: '2026-10-02T12:00:00Z', expiration_date: '2026-10-09T12:00:00Z', status: 'revised',
            proposal_option_name: 'Orçamento antigo', total_preco: 900, total_m2: 6, follow_up_revision: 2, films: [], payment_config: null,
        },
        // Orçamento de um cliente que não veio na busca: nunca aparece.
        { id: 999, client_id: 777, total_preco: 5000, proposal_option_name: 'Outro cliente', films: [] },
    ],
    company: {
        payment_methods: [{ tipo: 'parcelado_sem_juros', ativo: true, parcelas_max: 3 }],
        prazo_pagamento: 'Restante na conclusão',
        proposal_validity_days: 7,
    },
});

describe('leitura do CRM: propostas', () => {
    it('monta a proposta do link com opções, recomendada, condição e pagamento', () => {
        const result = shapeProposals(proposalRows(), NOW);
        expect(result.encontrado).toBe(true);
        expect(result.clientes).toEqual([{ ref: 101, primeiro_nome: 'Maria', bairro: 'Bessa', cidade: 'João Pessoa' }]);

        const link = result.propostas.find(item => item.tipo === 'link')!;
        expect(link).toMatchObject({
            id: 'link:portal-1', cliente_ref: 101, situacao: 'aguardando_resposta', visualizacoes: 3,
            valida_ate: '2026-11-25T10:00-03:00', opcao_recomendada_id: 502, opcao_escolhida_id: null, prazo_instalacao: null,
        });
        expect(link.opcoes.map(option => option.id)).toEqual([501, 502]);

        const economica = link.opcoes[0];
        expect(economica).toMatchObject({ nome: 'Opção econômica', versao: 1, valor_total: 1500, peliculas: ['Fumê G20'], condicao_especial: null });
        expect(economica.pagamento).toEqual({
            prazo: '50% na aprovação',
            origem: 'proposta',
            opcoes: [{ forma: 'pix', descricao: 'Pix à vista com 5% de desconto', parcelas: 1, valor_parcela: 1425, total: 1425 }],
        });

        const nano = link.opcoes[1];
        expect(nano.recomendada).toBe(true);
        expect(nano.valor_total).toBe(2160);
        expect(nano.condicao_especial).toEqual({
            valor_original: 2400, valor_final: 2160, desconto_valor: 240, desconto_percentual: 10, valida_ate: '2026-11-22T20:00-03:00',
        });
        // Sem forma de pagamento própria: usa a padrão da empresa e diz isso.
        expect(nano.pagamento.origem).toBe('padrao_empresa');
        expect(nano.pagamento.prazo).toBe('Restante na conclusão');
        expect(nano.pagamento.opcoes.map(option => option.parcelas)).toEqual([1, 2, 3]);
    });

    it('agrupa orçamentos sem link e mostra a versão', () => {
        const loose = shapeProposals(proposalRows(), NOW).propostas.find(item => item.tipo === 'orcamentos_sem_link')!;
        expect(loose.id).toBe('orcamentos:101');
        expect(loose.situacao).toBe('sem_link');
        expect(loose.opcoes.map(option => [option.id, option.versao, option.situacao_orcamento])).toEqual([[480, 3, 'revisado']]);
    });

    it('não devolve dados pessoais, link, arquivo nem orçamento de outro cliente', () => {
        const text = JSON.stringify(shapeProposals(proposalRows(), NOW));
        for (const secret of ['Aparecida', 'Silva', '99876', '123.456.789', 'Rua Secreta', '58035', 'segredo-do-link', 'privado/arquivo.pdf', 'cliente chato', 'Outro cliente', '999']) {
            expect(text).not.toContain(secret);
        }
    });

    it('marca situação aprovada, vencida e perdida', () => {
        const rows = proposalRows();
        rows.portals[0] = { ...rows.portals[0], status: 'approved', decision_pdf_id: 502, decision_at: '2026-11-19T15:00:00Z' };
        const approved = shapeProposals(rows, NOW).propostas[0];
        expect(approved.situacao).toBe('aprovada');
        expect(approved.opcao_escolhida_id).toBe(502);

        rows.portals[0] = { ...rows.portals[0], status: 'active', expires_at: '2026-11-19T13:00:00Z' };
        expect(shapeProposals(rows, NOW).propostas[0].situacao).toBe('vencida');

        rows.portals[0] = { ...rows.portals[0], lost_at: '2026-11-19T13:00:00Z' };
        expect(shapeProposals(rows, NOW).propostas[0].situacao).toBe('perdida');
    });

    it('telefone sem cadastro: resposta vazia, sem erro', () => {
        expect(shapeProposals({ clients: [], portals: [], items: [], pdfs: [] }, NOW)).toEqual({
            encontrado: false, clientes: [], propostas: [], avisos: [],
        });
    });

    it('avisa quando mais de um cadastro tem o mesmo telefone', () => {
        const rows = proposalRows();
        rows.clients.push({ id: 90, nome: 'Maria' });
        expect(shapeProposals(rows, NOW).avisos[0]).toContain('Mais de um cadastro');
    });
});

describe('leitura do CRM: agenda', () => {
    const hours = normalizeWorkingHours({ start: '08:00', end: '18:00', days: [1, 2, 3, 4, 5] })!;

    it('lê o horário de trabalho e recusa o que estiver incompleto', () => {
        expect(hours).toMatchObject({ start: 480, end: 1080, days: [1, 2, 3, 4, 5] });
        expect(normalizeWorkingHours({ start: '18:00', end: '08:00', days: [1] })).toBeNull();
        expect(normalizeWorkingHours({ start: '08:00', end: '18:00', days: [] })).toBeNull();
        expect(normalizeWorkingHours(null)).toBeNull();
    });

    it('calcula os horários livres tirando os compromissos', () => {
        const busy = [{ start: Date.parse('2026-11-23T10:00:00-03:00'), end: Date.parse('2026-11-23T12:00:00-03:00') }];
        const slots = freeSlots('2026-11-22', '2026-11-24', hours, busy, NOW).map(slot => [localIso(slot.start), localIso(slot.end)]);
        expect(slots).toEqual([
            // 22/11 é domingo: fora do horário de trabalho.
            ['2026-11-23T08:00-03:00', '2026-11-23T10:00-03:00'],
            ['2026-11-23T12:00-03:00', '2026-11-23T18:00-03:00'],
            ['2026-11-24T08:00-03:00', '2026-11-24T18:00-03:00'],
        ]);
    });

    it('não oferece horário que já passou nem janelas curtas', () => {
        const busy = [{ start: Date.parse('2026-11-20T12:10:00-03:00'), end: Date.parse('2026-11-20T17:45:00-03:00') }];
        // Hoje (sexta) ao meio-dia: sobra 12:00–12:10 (curta demais) e 17:45–18:00 (curta demais).
        expect(freeSlots('2026-11-20', '2026-11-20', hours, busy, NOW)).toEqual([]);
    });

    it('monta a agenda sem nome do cliente e com tipo e bairro', () => {
        const result = shapeAgenda({
            events: [
                { start: '2026-11-23T13:00:00Z', end: '2026-11-23T15:00:00Z', event_type: 'instalacao', service_status: 'scheduled', bairro: 'Tijuca', cidade: 'Rio de Janeiro', client_name: 'Maria Silva', notes: 'portão azul' } as any,
                { start: '2026-11-24T12:00:00Z', end: null, event_type: null, service_status: null, bairro: null, cidade: null },
            ],
            working_hours: { start: '08:00', end: '18:00', days: [1, 2, 3, 4, 5] },
        }, '2026-11-23', '2026-11-24', NOW);

        expect(result.fuso).toBe('America/Sao_Paulo');
        expect(result.horario_trabalho).toEqual({ inicio: '08:00', fim: '18:00', dias_semana: [1, 2, 3, 4, 5] });
        expect(result.ocupados).toEqual([
            { inicio: '2026-11-23T10:00-03:00', fim: '2026-11-23T12:00-03:00', tipo: 'instalacao', situacao: 'agendado', bairro: 'Tijuca', cidade: 'Rio de Janeiro' },
            // Sem fim: conta 1 hora.
            { inicio: '2026-11-24T09:00-03:00', fim: '2026-11-24T10:00-03:00', tipo: 'nao_informado', situacao: 'agendado', bairro: null, cidade: null },
        ]);
        expect(result.livres).toEqual([
            { inicio: '2026-11-23T08:00-03:00', fim: '2026-11-23T10:00-03:00' },
            { inicio: '2026-11-23T12:00-03:00', fim: '2026-11-23T18:00-03:00' },
            { inicio: '2026-11-24T08:00-03:00', fim: '2026-11-24T09:00-03:00' },
            { inicio: '2026-11-24T10:00-03:00', fim: '2026-11-24T18:00-03:00' },
        ]);
        const text = JSON.stringify(result);
        expect(text).not.toContain('Maria');
        expect(text).not.toContain('portão');
    });

    it('sem horário de trabalho configurado: não inventa horários livres', () => {
        const result = shapeAgenda({ events: [], working_hours: null }, '2026-11-23', '2026-11-23', NOW);
        expect(result.livres).toBeNull();
        expect(result.avisos[0]).toContain('não configurado');
    });
});
