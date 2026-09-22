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

    it('oferece somente as parcelas marcadas nesta proposta sem alterar as taxas globais', () => {
        const options = buildProposalPaymentOptions(1200, [
            { tipo: 'parcelado_sem_juros', ativo: true, parcelas_max: 4, selectedInstallments: [1, 3] },
            {
                tipo: 'parcelado_com_juros', ativo: true, parcelas_max: 12,
                selectedInstallments: [3, 6], calculation_mode: 'operator_fee',
                operator_fee_rates: { '3': 4, '6': 8, '12': 15 },
            },
        ]);
        expect(options.map(option => `${option.methodType}:${option.installments}`)).toEqual([
            'parcelado_sem_juros:1', 'parcelado_sem_juros:3',
            'parcelado_com_juros:3', 'parcelado_com_juros:6',
        ]);
        expect(options.find(option => option.methodType === 'parcelado_com_juros' && option.installments === 6)?.ratePercent).toBe(8);
        expect(resolveProposalPaymentChoice(1200, [{ tipo: 'parcelado_com_juros', ativo: true, parcelas_max: 12, selectedInstallments: [3], juros: 2 }], { methodType: 'parcelado_com_juros', installments: 12 })).toBeNull();
    });
});
