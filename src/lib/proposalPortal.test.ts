import { vi } from 'vitest';
import type { SavedPDF } from '../../types';
import { createProposalPortal, findClientProposalPortals, loadPublicProposalPortal, markProposalPortalLost, openPublicProposalPdf, recordProposalFollowUp, refreshProposalPortal, reopenProposalPortal, revokeProposalPortal } from './proposalPortal';

const {
    rpcMock,
    fromMock,
    functionsInvokeMock,
    isOnlineNowMock,
    syncAllPendingMock,
    findLocalPdfMock,
    listPdfSyncQueueMock,
    getUserMock,
} = vi.hoisted(() => ({
    rpcMock: vi.fn(),
    fromMock: vi.fn(),
    functionsInvokeMock: vi.fn(),
    isOnlineNowMock: vi.fn(() => true),
    syncAllPendingMock: vi.fn(),
    findLocalPdfMock: vi.fn(),
    listPdfSyncQueueMock: vi.fn(),
    getUserMock: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })),
}));

vi.mock('../../services/supabaseClient', () => ({
    supabase: { rpc: rpcMock, from: fromMock, functions: { invoke: functionsInvokeMock }, auth: { getUser: getUserMock } },
}));

vi.mock('../../services/syncService', () => ({
    isOnlineNow: isOnlineNowMock,
    syncAllPending: syncAllPendingMock,
}));

vi.mock('../../services/offlineDb', () => ({
    offlineDb: {
        savedPdfs: {
            filter: vi.fn(() => ({ first: findLocalPdfMock })),
        },
        syncQueue: {
            where: vi.fn(() => ({
                equals: vi.fn(() => ({ toArray: listPdfSyncQueueMock })),
            })),
        },
    },
}));

import { beforeEach, describe, expect, it } from 'vitest';
import { buildProposalClientSlug, buildProposalDecisionWhatsAppMessage, buildProposalPortalUrl } from './proposalPortal';

describe('links amigáveis de proposta', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        isOnlineNowMock.mockReturnValue(true);
        listPdfSyncQueueMock.mockResolvedValue([]);
        window.history.replaceState({}, '', '/');
    });

    it('usa apenas o primeiro nome sem acentos no endereço', () => {
        expect(buildProposalClientSlug('Vinícius Ferreira')).toBe('vinicius');
        expect(buildProposalPortalUrl('a7K9m2Q8x4Ab6TzP', 'Vinícius Ferreira'))
            .toBe('http://localhost:3000/p/vinicius/a7K9m2Q8x4Ab6TzP');
    });

    it('mantém o formato antigo quando não há nome', () => {
        expect(buildProposalPortalUrl('token-antigo'))
            .toBe('http://localhost:3000/proposta?token=token-antigo');
    });

    it('monta o resumo da decisao com o link publico para o WhatsApp', () => {
        const message = buildProposalDecisionWhatsAppMessage({
            clientName: 'Ana Souza',
            companyName: 'Filmes Teste',
            proposalName: 'Controle solar',
            proposalValue: 336,
            decision: {
                id: 1,
                sender_type: 'client',
                kind: 'negotiation',
                offer_type: 'fixed',
                offer_value: 300,
                body: 'Podemos fechar hoje?',
                created_at: '2026-07-23T10:00:00.000Z',
            },
            portalUrl: 'https://app.filmstec.shop/p/ana/codigo',
        });

        expect(message).toContain('Ana Souza');
        expect(message).toContain('Controle solar');
        expect(message).toContain('Quero negociar');
        expect(message).toContain('R$\u00a0300,00');
        expect(message).toContain('https://app.filmstec.shop/p/ana/codigo');
    });

    it('usa uma mensagem humana e direta quando a proposta foi aprovada', () => {
        const message = buildProposalDecisionWhatsAppMessage({
            clientName: 'Teste 2',
            companyName: 'Pel\u00edculas BR',
            proposalName: 'Controle solar',
            proposalValue: 0.25,
            decision: {
                id: 2,
                sender_type: 'client',
                kind: 'approved',
                payment_selection: {
                    method_type: 'pix',
                    installments: 1,
                    label: 'Pix \u00e0 vista',
                    customer_total: 0.25,
                    installment_value: 0.25,
                },
                created_at: '2026-07-23T10:00:00.000Z',
            },
            portalUrl: 'https://app.filmstec.shop/p/teste/codigo',
        });

        expect(message).toBe([
            'Ol\u00e1, equipe Pel\u00edculas BR!',
            'Sou Teste 2 e aprovei a proposta de Controle solar, no valor de R$\u00a00,25, com pagamento via Pix \u00e0 vista.',
            'Podemos agendar o servi\u00e7o?',
            '',
            'Ver proposta: https://app.filmstec.shop/p/teste/codigo',
        ].join('\n'));
    });

    it('entrega o link assim que a RPC cria o portal, sem uma segunda leitura', async () => {
        rpcMock.mockResolvedValue({
            data: [{ portal_id: 'portal-1', portal_token: 'token-seguro', expires_at: '2099-12-31T23:59:59.000Z' }],
            error: null,
        });

        const result = await createProposalPortal([{ id: 42 } as SavedPDF], '2099-12-31', 'Elaine');

        expect(result.url).toBe('http://localhost:3000/p/elaine/token-seguro');
        expect(fromMock).not.toHaveBeenCalled();
    });

    it('prefere o código curto quando a RPC nova o devolve', async () => {
        rpcMock.mockResolvedValue({
            data: [{ portal_id: 'portal-2', portal_token: 'token-seguro', portal_share_code: 'codigo-curto', expires_at: '2099-12-31T23:59:59.000Z' }],
            error: null,
        });

        const result = await createProposalPortal([{ id: 43 } as SavedPDF], '2099-12-31', 'Elaine');

        expect(result.url).toBe('http://localhost:3000/p/elaine/codigo-curto');
    });

    it('aguarda o ID remoto do PDF recem-gerado antes de criar o portal', async () => {
        findLocalPdfMock
            .mockResolvedValueOnce({ _localId: 'local_123_pdf', id: -123, _syncStatus: 'pending' })
            .mockResolvedValue({ _localId: 'local_123_pdf', id: 91, _remoteId: 91, _syncStatus: 'synced' });
        rpcMock.mockResolvedValue({
            data: [{ portal_id: 'portal-3', portal_token: 'token-seguro', expires_at: '2099-12-31T23:59:59.000Z' }],
            error: null,
        });

        await createProposalPortal([{ id: -123 } as SavedPDF], '2099-12-31', 'Elaine');

        expect(syncAllPendingMock).toHaveBeenCalledWith({ force: true });
        expect(rpcMock).toHaveBeenCalledWith('create_proposal_portal', expect.objectContaining({
            p_pdf_ids: [91],
        }));
    });

    it('aguarda uma renomeacao pendente chegar ao servidor antes de criar o portal', async () => {
        const localPdf = {
            _localId: 'local_123_pdf',
            id: 42,
            _remoteId: 42,
            _syncStatus: 'pending',
        };
        findLocalPdfMock.mockResolvedValue(localPdf);
        listPdfSyncQueueMock
            .mockResolvedValueOnce([{
                id: 7,
                table: 'savedPdfs',
                action: 'update',
                status: 'pending',
                retryCount: 0,
                timestamp: Date.now(),
                data: localPdf,
            }])
            .mockResolvedValue([]);
        rpcMock.mockResolvedValue({
            data: [{ portal_id: 'portal-4', portal_token: 'token-seguro', expires_at: '2099-12-31T23:59:59.000Z' }],
            error: null,
        });

        await createProposalPortal([{ id: 42 } as SavedPDF], '2099-12-31', 'Elaine');

        expect(syncAllPendingMock).toHaveBeenCalledWith({ force: true });
        expect(listPdfSyncQueueMock).toHaveBeenCalledTimes(2);
        expect(rpcMock).toHaveBeenCalledWith('create_proposal_portal', expect.objectContaining({
            p_pdf_ids: [42],
        }));
    });

    it('envia a última atividade conhecida nas verificações leves', async () => {
        functionsInvokeMock.mockResolvedValue({
            data: { unchanged: true, lastActivityAt: '2026-07-21T20:00:00.000Z' },
            error: null,
        });

        const result = await loadPublicProposalPortal('token-seguro', false, '2026-07-21T20:00:00.000Z');

        expect(functionsInvokeMock).toHaveBeenCalledWith('proposal-portal', {
            body: {
                token: 'token-seguro',
                action: 'load',
                trackView: false,
                knownActivityAt: '2026-07-21T20:00:00.000Z',
            },
        });
        expect(result).toEqual({ unchanged: true, lastActivityAt: '2026-07-21T20:00:00.000Z' });
    });
});


describe('ver PDF pelo link', () => {
    const fakeTab = () => ({ closed: false, close: vi.fn(), location: { href: '' }, document: { title: '', body: { innerHTML: '' } } });

    it('abre o PDF numa aba nova, criada no toque', async () => {
        const tab = fakeTab();
        const openSpy = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
        functionsInvokeMock.mockResolvedValue({ data: { url: 'https://storage/pdfs/a.pdf?token=x' }, error: null });

        await openPublicProposalPdf('tok', 7);

        expect(openSpy).toHaveBeenCalledWith('', '_blank');
        expect(functionsInvokeMock).toHaveBeenCalledWith('proposal-portal', { body: { token: 'tok', action: 'download', proposalId: 7, mode: 'view' } });
        expect(tab.location.href).toBe('https://storage/pdfs/a.pdf?token=x');
        expect(tab.close).not.toHaveBeenCalled();
        openSpy.mockRestore();
    });

    it('com servidor antigo (endereço de download) fecha a aba e baixa como antes', async () => {
        const tab = fakeTab();
        const openSpy = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
        const assignSpy = vi.fn();
        const originalLocation = window.location;
        Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, assign: assignSpy } });
        functionsInvokeMock.mockResolvedValue({ data: { url: 'https://storage/pdfs/a.pdf?token=x&download=proposta.pdf' }, error: null });

        await openPublicProposalPdf('tok', 7);

        expect(tab.close).toHaveBeenCalled();
        expect(assignSpy).toHaveBeenCalledWith('https://storage/pdfs/a.pdf?token=x&download=proposta.pdf');
        Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
        openSpy.mockRestore();
    });
});

describe('links já enviados ao cliente', () => {
    // Imita o encadeamento do Supabase (select().eq()...) terminando no resultado.
    const chain = (result: unknown) => {
        const builder: any = {};
        for (const method of ['select', 'in', 'eq', 'neq', 'order', 'limit', 'update']) builder[method] = vi.fn(() => builder);
        builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
        return builder;
    };

    beforeEach(() => {
        fromMock.mockReset();
        rpcMock.mockReset();
        isOnlineNowMock.mockReturnValue(true);
        findLocalPdfMock.mockResolvedValue(undefined);
        listPdfSyncQueueMock.mockResolvedValue([]);
    });

    it('acha os links do cliente e marca o que tem as mesmas propostas', async () => {
        const portals = chain({
            data: [
                { id: 'p2', token: 'tok-novo', status: 'active', expires_at: '2099-01-01T00:00:00Z', created_at: '2026-09-25T10:00:00Z', view_count: 2, last_viewed_at: null, proposal_portal_items: [{ saved_pdf_id: 42, position: 0, saved_pdfs: { proposal_option_name: 'Opção 1', total_preco: 365 } }] },
                { id: 'p1', token: 'tok-velho', status: 'approved', expires_at: '2020-01-01T00:00:00Z', created_at: '2026-09-01T10:00:00Z', view_count: 5, last_viewed_at: null, proposal_portal_items: [{ saved_pdf_id: 30, position: 0, saved_pdfs: { nome_arquivo: 'antigo.pdf', total_preco: 300 } }] },
            ],
            error: null,
        });
        fromMock.mockImplementation((table: string) => table === 'saved_pdfs' ? chain({ data: [{ client_id: 7 }], error: null }) : portals);

        const result = await findClientProposalPortals([{ id: 42 } as SavedPDF], 'Carlos Lima');

        expect(portals.eq).toHaveBeenCalledWith('client_id', 7);
        expect(portals.neq).toHaveBeenCalledWith('status', 'revoked');
        expect(result[0]).toMatchObject({ id: 'p2', url: 'http://localhost:3000/p/carlos/tok-novo', sameProposals: true, updatable: true, expired: false, viewCount: 2 });
        expect(result[0].proposals).toEqual([{ id: 42, name: 'Opção 1', total: 365 }]);
        expect(result[1]).toMatchObject({ id: 'p1', sameProposals: false, updatable: false, expired: true });
    });

    it('sem internet não procura', async () => {
        isOnlineNowMock.mockReturnValue(false);
        expect(await findClientProposalPortals([{ id: 42 } as SavedPDF], 'Carlos')).toEqual([]);
        expect(fromMock).not.toHaveBeenCalled();
    });

    it('atualiza o link mantendo o mesmo endereço', async () => {
        rpcMock.mockResolvedValue({ data: [{ portal_id: 'p2', portal_token: 'tok-novo', expires_at: '2099-12-31T23:59:59.000Z' }], error: null });

        const result = await refreshProposalPortal('p2', [{ id: 42 } as SavedPDF], '2099-12-31', 'Carlos');

        expect(rpcMock).toHaveBeenCalledWith('refresh_proposal_portal', expect.objectContaining({ p_portal_id: 'p2', p_pdf_ids: [42] }));
        expect(result.url).toBe('http://localhost:3000/p/carlos/tok-novo');
    });

    it('encerra o link marcando como encerrado', async () => {
        const builder = chain({ error: null });
        fromMock.mockReturnValue(builder);

        await revokeProposalPortal('p2');

        expect(fromMock).toHaveBeenCalledWith('proposal_portals');
        expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'revoked' }));
        expect(builder.eq).toHaveBeenCalledWith('id', 'p2');
    });
});

describe('acompanhamento das propostas', () => {
    const chain = (result: unknown) => {
        const builder: any = {};
        for (const method of ['select', 'in', 'eq', 'update', 'insert']) builder[method] = vi.fn(() => builder);
        builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
        return builder;
    };

    beforeEach(() => {
        fromMock.mockReset();
    });

    it('registra o contato com o passo e o canal', async () => {
        const builder = chain({ error: null });
        fromMock.mockReturnValue(builder);
        await recordProposalFollowUp('p1', 'hot', 'whatsapp');
        expect(fromMock).toHaveBeenCalledWith('proposal_portal_follow_ups');
        expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ portal_id: 'p1', kind: 'contact', step: 'hot', channel: 'whatsapp', created_by: 'user-1' }));
    });

    it('marca como perdida (no link e no histórico) e reabre', async () => {
        const portals = chain({ error: null });
        const events = chain({ error: null });
        fromMock.mockImplementation((table: string) => table === 'proposal_portals' ? portals : events);

        await markProposalPortalLost('p1', 'price', ' achou caro ');
        expect(portals.update).toHaveBeenCalledWith(expect.objectContaining({ lost_reason: 'price', lost_at: expect.any(String) }));
        expect(portals.eq).toHaveBeenCalledWith('id', 'p1');
        expect(events.insert).toHaveBeenCalledWith(expect.objectContaining({ kind: 'lost', reason: 'price', note: 'achou caro' }));

        await reopenProposalPortal('p1');
        expect(portals.update).toHaveBeenLastCalledWith(expect.objectContaining({ lost_at: null, lost_reason: null }));
        expect(events.insert).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'reopened' }));
    });
});
