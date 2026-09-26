import { buildPdfInstallmentLines, buildPdfWarrantyEntries, buildPrimaryPaymentSummary } from './pdfGenerator';
import type { Film } from '../types';

describe('buildPdfWarrantyEntries', () => {
    const films = [{ nome: 'Reflecta Clear', preco: 150, garantiaFabricante: 5, garantiaMaoDeObra: 90, garantiaMaoDeObraUnidade: 'dias' } as Film];
    const option = (name: string, generalDiscount?: any) => ({
        measurements: [{ pelicula: 'Reflecta Clear' }],
        generalDiscount,
        totals: { pricingMode: 'complete' as const },
        proposalOptionName: name,
    });

    it('usa a garantia do catálogo quando nenhuma opção personaliza', () => {
        expect(buildPdfWarrantyEntries([option('Opção 1')], films)).toEqual([{
            title: 'Reflecta Clear',
            lines: ['  - Garantia Fabricante: 5 anos', '  - Garantia Mão de Obra: 90 dias'],
        }]);
    });

    it('separa a mesma película com garantia maior em outra opção', () => {
        const entries = buildPdfWarrantyEntries([
            option('Básica'),
            option('Premium', { filmWarrantyOverrides: { 'Reflecta Clear': { garantiaFabricante: 10, garantiaMaoDeObra: 2, garantiaMaoDeObraUnidade: 'anos' } } }),
            option('Básica 2'),
        ], films);
        expect(entries).toEqual([
            { title: 'Reflecta Clear (Básica, Básica 2)', lines: ['  - Garantia Fabricante: 5 anos', '  - Garantia Mão de Obra: 90 dias'] },
            { title: 'Reflecta Clear (Premium)', lines: ['  - Garantia Fabricante: 10 anos', '  - Garantia Mão de Obra: 2 anos'] },
        ]);
    });
});

describe('parcelas no PDF', () => {
    it('sem juros em faixa sai numa linha e com juros só depois dele', () => {
        const methods = [
            { tipo: 'parcelado_sem_juros' as const, ativo: true, parcelas_max: 10, selectedInstallments: [1, 2, 3, 4, 5, 6] },
            { tipo: 'parcelado_com_juros' as const, ativo: true, parcelas_max: 12, juros: 2, selectedInstallments: [3, 11, 12] },
        ];
        expect(buildPdfInstallmentLines(600, methods[0], '', methods)).toEqual(['• Parcelado s/ Juros: 6x de R$ 100,00']);
        const withInterest = buildPdfInstallmentLines(600, methods[1], '', methods);
        expect(withInterest.join(' ')).not.toContain(' 3x');
        expect(withInterest.filter(line => line.startsWith('• '))).toHaveLength(2);

        // Buraco antigo (sem o 5x) continua listando cada parcela.
        const withGap = { ...methods[0], selectedInstallments: [1, 2, 3, 4, 6] };
        expect(buildPdfInstallmentLines(600, withGap, '', [withGap])).toHaveLength(5);
    });
});

describe('buildPrimaryPaymentSummary', () => {
    it('resume a condição principal de pagamento perto do valor final', () => {
        expect(buildPrimaryPaymentSummary(1000, {
            paymentMethods: [{ tipo: 'pix', ativo: true, porcentagem: 5 }],
            prazoPagamento: ''
        })).toBe('Pix: R$ 950,00 (5% de desconto)');

        expect(buildPrimaryPaymentSummary(1200, {
            paymentMethods: [{ tipo: 'parcelado_sem_juros', ativo: true, parcelas_max: 6 }],
            prazoPagamento: ''
        })).toBe('6x de R$ 200,00 sem juros');
    });

    it('mostra no PDF somente as parcelas marcadas com a taxa de cada uma', () => {
        const method = {
            tipo: 'parcelado_com_juros' as const,
            ativo: true,
            parcelas_max: 12,
            selectedInstallments: [3, 6],
            calculation_mode: 'operator_fee' as const,
            operator_fee_rates: { '3': 4, '6': 8, '12': 15 },
        };
        const lines = buildPdfInstallmentLines(1200, method);
        expect(lines).toEqual([
            '• Cartão parcelado: 3x de R$ 416,67',
            '  Total no cartão: R$ 1.250,01',
            '• Cartão parcelado: 6x de R$ 217,40',
            '  Total no cartão: R$ 1.304,40',
        ]);
        expect(lines.join(' ')).not.toContain('12x');
        expect(buildPrimaryPaymentSummary(1200, { paymentMethods: [method], prazoPagamento: '' }))
            .toBe('6x de R$ 217,40 no cartão');
    });
});
