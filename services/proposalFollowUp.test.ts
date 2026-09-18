import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client, SavedPDF } from '../types';
import { applyProposalFollowUp } from './proposalFollowUp';

const mocks = vi.hoisted(() => ({
    snapshot: vi.fn(), rpc: vi.fn(), upload: vi.fn(), generate: vi.fn(),
    resolve: vi.fn(), put: vi.fn(), first: vi.fn(),
}));
vi.mock('./supabaseClient', () => ({ supabase: {
    from: () => ({ select: () => ({ eq: () => ({ single: mocks.snapshot }) }) }), rpc: mocks.rpc,
} }));
vi.mock('./supabaseDb', () => ({
    getAllCustomFilms: async () => [], getUserInfo: async () => ({ empresa: 'Teste' }),
    uploadPdfToStorage: mocks.upload,
    mapRowToPDF: async (row: any) => ({ id: row.id, clienteId: row.client_id, totalPreco: row.total_preco,
        subtotal: row.subtotal, followUpRevision: row.follow_up_revision || 0,
        followUpBaseValue: row.follow_up_base_value, followUpDiscountPercent: row.follow_up_discount_percent,
        followUpDiscountAmount: row.follow_up_discount_amount, measurements: [] }),
}));
vi.mock('./pdfGenerator', () => ({ regeneratePDFFromSaved: mocks.generate }));
vi.mock('./offlineDb', () => ({ offlineDb: { savedPdfs: {
    filter: () => ({ first: mocks.first }), put: mocks.put,
} } }));
vi.mock('../src/lib/proposalPortal', () => ({ resolvePersistedProposalPdfIds: mocks.resolve }));

const pdf = { id: 10, clienteId: 1, totalPreco: 1890.50, subtotal: 2032.80 } as SavedPDF;
const client = { id: 1, nome: 'Ana' } as Client;
describe('gravação do follow-up e PDF', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.resolve.mockResolvedValue([10]);
        mocks.first.mockResolvedValue(undefined);
        mocks.generate.mockResolvedValue(new Blob(['PDF atualizado']));
        mocks.upload.mockResolvedValue('new.pdf');
        mocks.snapshot.mockResolvedValue({ data: { id: 10, client_id: 1, total_preco: 1890.50, subtotal: 2032.80 }, error: null });
        mocks.rpc.mockResolvedValue({ data: { id: 10, client_id: 1, total_preco: 1512.40, subtotal: 2032.80,
            follow_up_revision: 1, follow_up_base_value: 1890.50, follow_up_discount_percent: 20, follow_up_discount_amount: 378.10 }, error: null });
    });

    it('gera e envia o PDF correto antes da transação e atualiza o cache após confirmar', async () => {
        const event = vi.fn();
        window.addEventListener('proposal-price-updated', event);
        try {
            const result = await applyProposalFollowUp(pdf, client, '20', 'percentage');
            expect(mocks.generate).toHaveBeenCalledWith(client, expect.anything(), expect.objectContaining({ totalPreco: 1512.40, subtotal: 2032.80 }), []);
            expect(mocks.upload.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0]);
            expect(mocks.rpc).toHaveBeenCalledWith('apply_proposal_follow_up', expect.objectContaining({
                p_pdf_id: 10, p_discount: 20, p_pdf_path: 'new.pdf', p_expected_snapshot: expect.objectContaining({ total_preco: 1890.50 }),
            }));
            expect(result.totalPreco).toBe(1512.40);
            expect(mocks.put).toHaveBeenCalledWith(expect.objectContaining({ totalPreco: 1512.40, _syncStatus: 'synced' }));
            expect(event).toHaveBeenCalledTimes(1);
        } finally {
            window.removeEventListener('proposal-price-updated', event);
        }
    });

    it('falha no PDF não altera a proposta', async () => {
        mocks.generate.mockRejectedValueOnce(new Error('PDF inválido'));
        await expect(applyProposalFollowUp(pdf, client, '20', 'percentage')).rejects.toThrow('PDF inválido');
        expect(mocks.rpc).not.toHaveBeenCalled();
        expect(mocks.put).not.toHaveBeenCalled();
    });

    it('conflito remoto não salva dados otimistas no cache', async () => {
        mocks.rpc.mockResolvedValueOnce({ error: new Error('Conflito') });
        await expect(applyProposalFollowUp(pdf, client, '20', 'percentage')).rejects.toThrow('Conflito');
        expect(mocks.put).not.toHaveBeenCalled();
    });

    it('rejeita uma confirmação baseada em valor antigo', async () => {
        mocks.snapshot.mockResolvedValueOnce({ data: { total_preco: 2000, follow_up_revision: 1 } });
        await expect(applyProposalFollowUp(pdf, client, '20', 'percentage')).rejects.toThrow(/outro aparelho/);
        expect(mocks.generate).not.toHaveBeenCalled();
        expect(mocks.rpc).not.toHaveBeenCalled();
    });
});
