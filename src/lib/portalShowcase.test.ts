import { describe, expect, it } from 'vitest';
import { buildPublicShowcase, sanitizeShowcase } from '../../supabase/functions/proposal-portal/portalShowcase';
import { selectCompanyBranding } from '../../supabase/functions/proposal-portal/companyBranding';

describe('vitrine da página da proposta', () => {
    it('limpa os dados: nota até 5, até 3 depoimentos com texto e até 8 fotos', () => {
        const showcase = sanitizeShowcase({
            googleRating: 7.26,
            googleReviewCount: '127',
            testimonials: [{ name: 'Ana', text: 'Ótimo' }, { name: 'Sem texto', text: '  ' }, { name: 'B', text: '2' }, { name: 'C', text: '3' }, { name: 'D', text: '4' }],
            photos: Array.from({ length: 10 }, (_, index) => ({ path: `owner/${index}.jpg` })).concat([{ path: '../fora.jpg' }]),
        });
        expect(showcase.googleRating).toBe(5);
        expect(showcase.googleReviewCount).toBe(127);
        expect(showcase.testimonials?.map(item => item.name)).toEqual(['Ana', 'B', 'C']);
        expect(showcase.photos).toHaveLength(8);
    });

    it('só mostra o que existe; link do Google só se for https', () => {
        expect(buildPublicShowcase({}, 'https://g.page/r/x', path => path)).toBeNull();
        const shown = buildPublicShowcase({ googleRating: 4.9, photos: [{ path: 'o/a.jpg', caption: 'Sala' }] }, 'javascript:alert(1)', path => `https://cdn/${path}`);
        expect(shown).toEqual({ rating: 4.9, reviewCount: null, reviewsUrl: null, testimonials: [], photos: [{ url: 'https://cdn/o/a.jpg', caption: 'Sala' }] });
    });

    it('a vitrine vem do dono da empresa (com o link de avaliação dele)', () => {
        const branding = selectCompanyBranding(
            { name: 'Empresa', owner_id: 'owner-1' },
            [
                { user_id: 'creator-1', empresa: 'Colaborador', portal_showcase: { googleRating: 3 } },
                { user_id: 'owner-1', empresa: 'Empresa oficial', portal_showcase: { googleRating: 4.8, testimonials: [{ name: 'Ana', text: 'Recomendo' }] }, social_links: { googleReviews: 'https://g.page/r/abc/review' } },
            ],
            'creator-1',
            path => `https://cdn/${path}`,
        );
        expect(branding.showcase).toEqual({ rating: 4.8, reviewCount: null, reviewsUrl: 'https://g.page/r/abc/review', testimonials: [{ name: 'Ana', text: 'Recomendo' }], photos: [] });
    });
});
