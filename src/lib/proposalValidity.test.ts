import { describe, expect, it } from 'vitest';
import { resolveProposalValidityDays } from './proposalValidity';

describe('resolveProposalValidityDays', () => {
    it('usa a validade escolhida na proposta, inclusive fora dos presets', () => {
        expect(resolveProposalValidityDays(45, 30)).toBe(45);
        expect(resolveProposalValidityDays(10, 30)).toBe(10);
    });

    it('limita a escolha da proposta ao teto de 60 dias', () => {
        expect(resolveProposalValidityDays(90, 30)).toBe(60);
    });

    it('sem escolha válida na proposta, usa o padrão da empresa', () => {
        expect(resolveProposalValidityDays(undefined, 15)).toBe(15);
        expect(resolveProposalValidityDays(null, 60)).toBe(60);
        expect(resolveProposalValidityDays(0, 7)).toBe(7);
        expect(resolveProposalValidityDays(undefined, undefined)).toBe(30);
    });
});
