import { buildProposalReactivationMessages, getProposalCondition } from './proposalCondition';

describe('proposalCondition', () => {
    it('calcula a condicao ativa e o percentual quando necessario', () => {
        const now = new Date('2026-07-15T10:00:00Z').getTime();
        const condition = getProposalCondition({
            conditionOriginalValue: 1000,
            conditionFinalValue: 850,
            conditionDiscountAmount: 150,
            conditionExpiresAt: '2026-07-16T10:00:00Z',
        }, now);

        expect(condition?.expired).toBe(false);
        expect(condition?.remainingMs).toBe(86_400_000);
        expect(condition?.discountPercent).toBeCloseTo(15);
    });

    it('mantem os valores visiveis depois do vencimento', () => {
        const condition = getProposalCondition({
            conditionOriginalValue: 1000,
            conditionFinalValue: 850,
            conditionDiscountAmount: 150,
            conditionExpiresAt: '2026-07-14T10:00:00Z',
        }, new Date('2026-07-15T10:00:00Z').getTime());

        expect(condition?.expired).toBe(true);
        expect(condition?.finalValue).toBe(850);
    });

    it('gera mensagens com cliente, valor, economia e vencimento', () => {
        const messages = buildProposalReactivationMessages({
            clientName: 'Marcos Oliveira',
            finalValue: 850,
            discountAmount: 150,
            expiresAt: '2026-07-16T13:30:00-03:00',
        });

        expect(messages).toHaveLength(3);
        expect(messages[0].text).toContain('Marcos');
        expect(messages[0].text).toContain('R$\u00a0850,00');
        expect(messages[0].text).toContain('R$\u00a0150,00');
    });
});
