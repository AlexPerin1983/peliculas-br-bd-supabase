import { describe, expect, it } from 'vitest';
import { escapeHtml, injectProposalPreview, resolvePreviewImage } from '../../api/proposta-preview.js';

describe('prévia amigável da proposta', () => {
    it('usa a logo pública da empresa e personaliza o primeiro nome', () => {
        const html = '<html><head><title>Aplicativo</title><meta name="description" content="antiga"></head><body></body></html>';
        const result = injectProposalPreview(html, {
            clientName: 'Vinícius Ferreira',
            companyName: 'Películas Brasil',
            companyLogo: 'https://cdn.example.com/logo.png',
            expiresAt: '2026-07-22T23:59:59-03:00',
        }, 'https://app.filmstec.shop/p/vinicius/codigo', 'https://app.filmstec.shop');

        expect(result).toContain('Proposta para Vinícius | Películas Brasil');
        expect(result).toContain('Disponível até 22/07/2026');
        expect(result).toContain('https://cdn.example.com/logo.png');
        expect(result).not.toContain('content="antiga"');
    });

    it('usa o ícone padrão quando a logo não é uma URL pública', () => {
        expect(resolvePreviewImage('data:image/png;base64,abc', 'https://app.filmstec.shop', 'codigo'))
            .toBe('https://app.filmstec.shop/api/proposta-logo?code=codigo');
    });

    it('protege os metadados contra HTML inserido nos nomes', () => {
        expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    });
});

