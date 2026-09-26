import { describe, expect, it } from 'vitest';
import { buildProposalPaymentOptions, resolveProposalPaymentChoice } from './paymentConditions';
import { buildPaymentOptions } from '../../supabase/functions/proposal-portal/paymentOptions';

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
        // 3x já é sem juros: não pode sair também "3x com juros".
        expect(options.map(option => `${option.methodType}:${option.installments}`)).toEqual([
            'parcelado_sem_juros:1', 'parcelado_sem_juros:3',
            'parcelado_com_juros:6',
        ]);
        expect(options.find(option => option.methodType === 'parcelado_com_juros' && option.installments === 6)?.ratePercent).toBe(8);
        expect(resolveProposalPaymentChoice(1200, [{ tipo: 'parcelado_com_juros', ativo: true, parcelas_max: 12, selectedInstallments: [3], juros: 2 }], { methodType: 'parcelado_com_juros', installments: 12 })).toBeNull();
    });

    it('o servidor da aprovação usa as parcelas escolhidas na proposta', () => {
        // Antes o servidor ignorava a escolha: com "sem juros até 6x" achava que ia até 10x
        // e recusava "7x no cartão" ("Escolha como deseja pagar antes de aprovar").
        const methods = [
            { tipo: 'parcelado_sem_juros', ativo: true, parcelas_max: 10, selectedInstallments: [1, 2, 3, 4, 5, 6] },
            { tipo: 'parcelado_com_juros', ativo: true, parcelas_max: 12, juros: 2, selectedInstallments: [7, 8, 9, 10, 11, 12] },
        ];
        const serverOptions = buildPaymentOptions(365, methods);
        expect(serverOptions.find(option => option.methodType === 'parcelado_com_juros' && option.installments === 7)).toBeDefined();
        expect(serverOptions.find(option => option.methodType === 'parcelado_sem_juros' && option.installments === 8)).toBeUndefined();
        // App e servidor calculam igual.
        expect(buildProposalPaymentOptions(365, methods as any)).toEqual(serverOptions);
    });

    it('sem juros soma exatamente o valor da proposta (a última parcela fica com os centavos)', () => {
        const options = buildProposalPaymentOptions(365, [{ tipo: 'parcelado_sem_juros', ativo: true, parcelas_max: 10 }]);
        options.forEach(option => {
            expect(option.customerTotal).toBe(365);
            const last = option.lastInstallmentValue ?? option.installmentValue;
            expect(Math.round((option.installmentValue * (option.installments - 1) + last) * 100) / 100).toBe(365);
        });
        const threeX = options.find(option => option.installments === 3)!;
        expect(threeX).toMatchObject({ installmentValue: 121.67, lastInstallmentValue: 121.66, customerTotal: 365 });
        // Divisão exata não mostra "última".
        expect(options.find(option => option.installments === 2)!.lastInstallmentValue).toBeUndefined();
        // 7x de 100: 14,29 × 6 + 14,26.
        expect(buildProposalPaymentOptions(100, [{ tipo: 'parcelado_sem_juros', ativo: true, parcelas_max: 7 }]).at(-1))
            .toMatchObject({ installmentValue: 14.29, lastInstallmentValue: 14.26, customerTotal: 100 });
    });

    it('com juros só depois da última parcela sem juros, mesmo em orçamentos já salvos', () => {
        const kinds = (methods: Parameters<typeof buildProposalPaymentOptions>[1]) => buildProposalPaymentOptions(365, methods)
            .map(option => `${option.methodType === 'parcelado_sem_juros' ? 's' : 'c'}${option.installments}`);

        // Sem juros até 10x e com juros 3x, 11x, 12x: o 3x com juros sai.
        expect(kinds([
            { tipo: 'parcelado_sem_juros', ativo: true, parcelas_max: 10 },
            { tipo: 'parcelado_com_juros', ativo: true, parcelas_max: 12, juros: 2, selectedInstallments: [3, 11, 12] },
        ])).toEqual(['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 'c11', 'c12']);

        // Invertido (juros em 1x-3x e sem juros em 4x-10x): juros nas parcelas menores não sai.
        expect(kinds([
            { tipo: 'parcelado_sem_juros', ativo: true, parcelas_max: 10, selectedInstallments: [4, 5, 6, 7, 8, 9, 10] },
            { tipo: 'parcelado_com_juros', ativo: true, parcelas_max: 12, juros: 2, selectedInstallments: [1, 2, 3] },
        ])).toEqual(['s4', 's5', 's6', 's7', 's8', 's9', 's10']);
    });
});
