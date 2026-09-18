import { buildPrimaryPaymentSummary } from './pdfGenerator';

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
});
