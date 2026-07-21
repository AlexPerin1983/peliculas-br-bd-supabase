import { vi } from 'vitest';
import type { SavedPDF } from '../../types';
import { createProposalPortal, loadPublicProposalPortal } from './proposalPortal';

const { rpcMock, fromMock, functionsInvokeMock } = vi.hoisted(() => ({
    rpcMock: vi.fn(),
    fromMock: vi.fn(),
    functionsInvokeMock: vi.fn(),
}));

vi.mock('../../services/supabaseClient', () => ({
    supabase: { rpc: rpcMock, from: fromMock, functions: { invoke: functionsInvokeMock } },
}));

import { beforeEach, describe, expect, it } from 'vitest';
import { buildProposalClientSlug, buildProposalPortalUrl } from './proposalPortal';

describe('links amigáveis de proposta', () => {
    beforeEach(() => window.history.replaceState({}, '', '/'));

    it('usa apenas o primeiro nome sem acentos no endereço', () => {
        expect(buildProposalClientSlug('Vinícius Ferreira')).toBe('vinicius');
        expect(buildProposalPortalUrl('a7K9m2Q8x4Ab6TzP', 'Vinícius Ferreira'))
            .toBe('http://localhost:3000/p/vinicius/a7K9m2Q8x4Ab6TzP');
    });

    it('mantém o formato antigo quando não há nome', () => {
        expect(buildProposalPortalUrl('token-antigo'))
            .toBe('http://localhost:3000/proposta?token=token-antigo');
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

