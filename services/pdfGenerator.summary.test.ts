import { buildPdfInstallmentLines, buildPrimaryPaymentSummary } from './pdfGenerator';

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
