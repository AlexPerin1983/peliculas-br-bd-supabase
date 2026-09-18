// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { regeneratePDFFromSaved, generateCombinedPDF } from './pdfGenerator';
import { previewProposalFollowUp } from '../src/lib/proposalFollowUp';
import type { Client, SavedPDF, UserInfo } from '../types';

vi.mock('./defaultLogo', () => ({ createDefaultLogo: () => '' }));

const client = { id: 1, nome: 'Cliente Teste', telefone: '85999999999' } as Client;
const user = { nome: 'Empresa', empresa: 'Teste', telefone: '85999999999', email: 'teste@example.com',
    incluirTermoResponsabilidadePadrao: false, payment_methods: [] } as UserInfo;
const original: SavedPDF = { id: 10, clienteId: 1, date: '2026-09-15', subtotal: 2032.80,
    totalPreco: 1890.50, totalM2: 10, generalDiscountAmount: 142.30,
    generalDiscount: { value: '142.30', type: 'fixed', operation: 'discount' },
    nomeArquivo: 'proposta.pdf', proposalOptionName: 'Térmico', measurements: [] };
const text = async (blob: Blob) => Buffer.from(await blob.arrayBuffer()).toString('latin1');

describe('PDF real de follow-up', () => {
    it('regenera o documento com total de 1.512,40 e desconto total de 520,40', async () => {
        const discounted = previewProposalFollowUp(original, '20', 'percentage');
        const content = await text(await regeneratePDFFromSaved(client, user, discounted, []));
        expect(content).toContain('%PDF-');
        expect(content).toContain('(R$ 1.512,40)');
        expect(content).toContain('(- R$ 520,40)');
        expect(content).not.toContain('(R$ 1.626,24)');
    });

    it('remover restaura o PDF para 1.890,50; 100% mantém zero', async () => {
        const discounted = previewProposalFollowUp(original, '20', 'percentage');
        const restored = previewProposalFollowUp(discounted, '', 'percentage');
        const content = await text(await regeneratePDFFromSaved(client, user, restored, []));
        expect(content).toContain('(R$ 1.890,50)');
        expect(content).not.toContain('(R$ 1.512,40)');
        const free = previewProposalFollowUp(original, '100', 'percentage');
        expect(await text(await regeneratePDFFromSaved(client, user, free, []))).toContain('(R$ 0,00)');
    });

    it('PDF combinado preserva o total da outra proposta', async () => {
        const discounted = previewProposalFollowUp(original, '20', 'percentage');
        const other = { ...original, id: 11, totalPreco: 2000, subtotal: 2000, generalDiscountAmount: 0, generalDiscount: undefined };
        const content = await text(await generateCombinedPDF(client, user, [discounted, other], []));
        expect(content).toContain('(R$ 1.512,40)');
        expect(content).toContain('(R$ 2.000,00)');
    });
});
