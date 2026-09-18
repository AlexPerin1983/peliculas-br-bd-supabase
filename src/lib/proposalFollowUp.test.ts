import { describe, expect, it } from 'vitest';
import type { SavedPDF } from '../../types';
import { previewProposalFollowUp } from './proposalFollowUp';
import { resolvePortalPricing } from '../../supabase/functions/proposal-portal/followUpPricing';
import { getProposalCondition } from './proposalCondition';
import { buildProposalShareMessage } from './proposalPortal';

const proposal: SavedPDF = {
    id: 1, clienteId: 2, date: '2026-09-15', totalPreco: 1890.50, subtotal: 2032.80,
    totalM2: 10, nomeArquivo: 'termico.pdf', proposalOptionName: 'Térmico',
};

describe('desconto persistente de follow-up', () => {
    it('usa 1.890,50 como base e preserva 2.032,80 como original', () => {
        const discounted = previewProposalFollowUp(proposal, '20', 'percentage');
        expect(discounted).toMatchObject({ totalPreco: 1512.40, subtotal: 2032.80,
            followUpBaseValue: 1890.50, followUpDiscountAmount: 378.10, followUpDiscountPercent: 20 });
        expect(proposal.totalPreco).toBe(1890.50);
    });

    it('substitui, repete e remove sem acumular descontos', () => {
        const discounted = previewProposalFollowUp(proposal, '20', 'percentage');
        expect(previewProposalFollowUp(discounted, '20', 'percentage').totalPreco).toBe(1512.40);
        expect(previewProposalFollowUp(discounted, '10', 'percentage').totalPreco).toBe(1701.45);
        for (const raw of ['0', '']) {
            const removed = previewProposalFollowUp(discounted, raw, 'percentage');
            expect(removed.totalPreco).toBe(1890.50);
            expect(removed.followUpBaseValue).toBeUndefined();
            expect(removed.followUpDiscountAmount).toBe(0);
            expect(removed.subtotal).toBe(2032.80);
        }
    });

    it('limita percentuais, arredonda centavos e mantém desconto em reais', () => {
        expect(previewProposalFollowUp(proposal, '150', 'percentage').totalPreco).toBe(0);
        expect(previewProposalFollowUp(proposal, '-5', 'percentage').totalPreco).toBe(1890.50);
        expect(previewProposalFollowUp(proposal, '378,10', 'fixed').totalPreco).toBe(1512.40);
        expect(previewProposalFollowUp({ ...proposal, totalPreco: 0.05 }, '10', 'percentage').totalPreco).toBe(0.04);
    });

    it('links antigos e aprovação leem a proposta, ignorando a condição congelada', () => {
        const legacy = { condition_final_value: 1626.24, condition_expires_at: '2020-01-01' };
        const pdf = { total_preco: 1512.40, follow_up_revision: 1, follow_up_base_value: 1890.50,
            follow_up_discount_amount: 378.10, follow_up_discount_percent: 20 };
        const pricing = resolvePortalPricing(pdf, legacy, '2099-01-01');
        expect(getProposalCondition(pricing)).toMatchObject({ finalValue: 1512.40, originalValue: 1890.50, discountPercent: 20, expired: false });
        expect(resolvePortalPricing({ total_preco: 0, follow_up_revision: 2 }, legacy, '2099-01-01').conditionFinalValue).toBe(0);
        const removed = resolvePortalPricing({ total_preco: 1890.50, follow_up_revision: 3 }, legacy, '2099-01-01');
        expect(removed.conditionFinalValue).toBe(1890.50);
        expect(getProposalCondition(removed)).toBeNull();
        // Another proposal in the same link keeps its own legacy condition.
        expect(resolvePortalPricing({ total_preco: 2000 }, legacy, '2099-01-01').conditionFinalValue).toBe(1626.24);
    });

    it('inclui o valor final na mensagem do link para WhatsApp', () => {
        const discounted = previewProposalFollowUp(proposal, '20', 'percentage');
        const message = buildProposalShareMessage({ nome: 'Ana Silva' } as any, [discounted], 'https://example.com/p/ana/test', '2099-01-01');
        expect(message.replace(/\u00a0/g, ' ')).toContain('Térmico: R$ 1.512,40');
        expect(message).not.toContain('1.890,50');
    });
});
