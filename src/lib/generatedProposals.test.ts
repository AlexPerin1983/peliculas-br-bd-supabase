import { describe, expect, it } from 'vitest';
import type { SavedPDF } from '../../types';
import { buildPdfContentSignature, getProposalKey, listClientProposals } from './generatedProposals';

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

describe('mudou algo desde o último PDF?', () => {
    const base = () => ({
        client: { id: 7, nome: 'Camila', telefone: '83999990000', email: '', cpfCnpj: '', lastUpdated: '2026-10-07T10:00:00Z' },
        option: { id: 100, name: 'Opção 1', measurements: [], generalDiscount: { value: '0', type: 'percentage' as const } },
        measurements: [
            { id: 1, largura: '2', altura: '1', quantidade: 1, ambiente: 'Sala', tipoAplicacao: 'Interna', pelicula: 'Suntek', active: true },
            { id: 2, largura: '1', altura: '1', quantidade: 1, ambiente: 'Quarto', tipoAplicacao: 'Interna', pelicula: 'Blackout', active: false },
        ],
        films: [{ nome: 'Suntek', preco: 100 }, { nome: 'Blackout', preco: 80 }, { nome: 'Outra', preco: 50 }],
        generalDiscount: { value: '0', type: 'percentage' },
        totals: { finalTotal: 200, operationalExpenses: 0 },
        paymentConfig: { paymentMethods: [] },
        userInfo: { id: 'info', nome: 'Alex', empresa: 'Películas', telefone: '', email: '', endereco: '', cpfCnpj: '', lastSelectedClientId: 7 },
    });
    const signature = (overrides: Record<string, unknown> = {}) =>
        buildPdfContentSignature({ ...base(), ...overrides } as Parameters<typeof buildPdfContentSignature>[0]);

    it('ignora o que não aparece no PDF', () => {
        const same = base();
        expect(signature({
            measurements: same.measurements.map(m => ({ ...m, id: m.id + 100, isNew: true, focusField: 'largura' })),
            client: { ...same.client, lastUpdated: '2026-10-08T09:00:00Z', pinned: true },
            userInfo: { ...same.userInfo, lastSelectedClientId: 9 },
            films: [...same.films, { nome: 'Nova no catálogo', preco: 10 }],
            // Cálculo de corte refeito sozinho: o efeito dele vem pelos totais.
            generalDiscount: { ...same.generalDiscount, filmCuttingSettings: { Suntek: { totalLinearMeters: 3 } } },
        })).toBe(signature());
        // Medida desligada não entra no PDF.
        expect(signature({ measurements: [same.measurements[0], { ...same.measurements[1], largura: '9' }] })).toBe(signature());
    });

    it('percebe o que muda o PDF', () => {
        const same = base();
        expect(signature({ measurements: [{ ...same.measurements[0], largura: '3' }, same.measurements[1]] })).not.toBe(signature());
        expect(signature({ films: [{ nome: 'Suntek', preco: 120 }, ...same.films.slice(1)] })).not.toBe(signature());
        expect(signature({ totals: { finalTotal: 210, operationalExpenses: 0 } })).not.toBe(signature());
        expect(signature({ totals: { finalTotal: 200, operationalExpenses: 30 } })).not.toBe(signature());
        expect(signature({ option: { ...same.option, id: 101 } })).not.toBe(signature());
        expect(signature({ client: { ...same.client, telefone: '83911112222' } })).not.toBe(signature());
        expect(signature({ paymentConfig: { paymentMethods: ['pix'] } })).not.toBe(signature());
    });
});
