import { describe, expect, it } from 'vitest';
import { buildProposalPaymentOptions, resolveProposalPaymentChoice } from './paymentConditions';

describe('payment conditions', () => {
    it('repassa a taxa da operadora sem reduzir o valor líquido', () => {
        const options = buildProposalPaymentOptions(442.89, [{
            tipo: 'parcelado_com_juros',
            ativo: true,
            parcelas_max: 10,
            calculation_mode: 'operator_fee',
            operator_fee_rates: { '10': 11.06 },
        }]);
        expect(options).toHaveLength(1);
        expect(options[0]).toMatchObject({
            installments: 10,
            installmentValue: 49.8,
            customerTotal: 498,
            ratePercent: 11.06,
        });
        expect(options[0].customerTotal * (1 - 0.1106)).toBeGreaterThanOrEqual(442.89);
    });

    it('aplica desconto no Pix sobre o valor aprovado', () => {
        const [pix] = buildProposalPaymentOptions(1000, [{ tipo: 'pix', ativo: true, porcentagem: 5 }]);
        expect(pix.customerTotal).toBe(950);
        expect(pix.discountPercent).toBe(5);
    });

    it('mantém compatibilidade com juros mensais antigos', () => {
        const selected = resolveProposalPaymentChoice(1000, [{
            tipo: 'parcelado_com_juros',
            ativo: true,
            parcelas_max: 3,
            juros: 2,
        }], { methodType: 'parcelado_com_juros', installments: 3 });
        expect(selected?.calculationMode).toBe('monthly_interest');
        expect(selected?.customerTotal).toBeGreaterThan(1000);
    });
});
