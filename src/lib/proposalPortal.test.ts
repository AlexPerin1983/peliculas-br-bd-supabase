import { beforeEach, describe, expect, it } from 'vitest';
import { buildProposalClientSlug, buildProposalPortalUrl } from './proposalPortal';

describe('links amigáveis de proposta', () => {
    beforeEach(() => window.history.replaceState({}, '', '/'));

    it('usa apenas o primeiro nome sem acentos no endereço', () => {
        expect(buildProposalClientSlug('Vinícius Ferreira')).toBe('vinicius');
        expect(buildProposalPortalUrl('a7K9m2Q8x4Ab6TzP', 'Vinícius Ferreira'))
            .toBe('http://localhost:3000/p/vinicius/a7K9m2Q8x4Ab6TzP');
    });

    it('mantém o formato antigo quando não há nome', () => {
        expect(buildProposalPortalUrl('token-antigo'))
            .toBe('http://localhost:3000/proposta?token=token-antigo');
    });
});

