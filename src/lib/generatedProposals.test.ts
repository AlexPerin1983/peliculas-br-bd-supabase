import { describe, expect, it } from 'vitest';
import type { SavedPDF } from '../../types';
import { getProposalKey, listClientProposals } from './generatedProposals';

const pdf = (overrides: Partial<SavedPDF>): SavedPDF => ({
    id: 1,
    clienteId: 7,
    proposalOptionId: 100,
    proposalOptionName: 'Opção 1',
    date: '2026-10-07T10:00:00.000Z',
    totalPreco: 500,
    totalM2: 1,
    nomeArquivo: 'a.pdf',
    status: 'pending',
    ...overrides,
});

describe('propostas geradas do cliente', () => {
    it('a identificação não muda quando o id provisório vira definitivo', () => {
        expect(getProposalKey(pdf({ id: -1791 }))).toBe(getProposalKey(pdf({ id: 42 })));
        expect(getProposalKey(pdf({ proposalOptionId: 101 }))).not.toBe(getProposalKey(pdf({})));
    });

    it('não repete a mesma proposta, fica com a definitiva e mantém o PDF em memória', () => {
        const blob = new Blob(['%PDF']);
        const list = listClientProposals([
            pdf({ id: -1791, pdfBlob: blob }),
            pdf({ id: 42 }),
            pdf({ id: 43, proposalOptionId: 101, proposalOptionName: 'Window Blue', date: '2026-10-07T10:05:00.000Z' }),
            pdf({ id: 50, clienteId: 8 }),
        ], 7);

        expect(list.map(item => item.id)).toEqual([43, 42]);
        expect(list[1].pdfBlob).toBe(blob);
    });

    it('limita às mais recentes', () => {
        const many = Array.from({ length: 8 }, (_, index) => pdf({
            id: index + 1,
            proposalOptionId: index,
            date: `2026-10-0${index + 1}T10:00:00.000Z`,
        }));
        expect(listClientProposals(many, 7).map(item => item.id)).toEqual([8, 7, 6, 5, 4, 3]);
    });
});
