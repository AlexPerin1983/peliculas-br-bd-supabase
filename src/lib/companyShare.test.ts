import { describe, expect, it } from 'vitest';
import {
    buildCompanyShareLinks,
    buildCompanyShareText,
    getCompanyPrimaryShareUrl,
    normalizeCompanyPhone,
} from './companyShare';

describe('ficha de compartilhamento da empresa', () => {
    const company = {
        empresa: 'Window Film BR',
        telefone: '(83) 99999-0000',
        email: 'contato@windowfilm.br',
        site: 'windowfilm.br',
        endereco: 'Av. Principal, 100 - João Pessoa',
        socialLinks: {
            instagram: '@windowfilm.br',
            facebook: 'https://facebook.com/windowfilmbr',
            tiktok: '@windowfilmbr',
        },
    };

    it('normaliza telefone brasileiro para o link do WhatsApp', () => {
        expect(normalizeCompanyPhone(company.telefone)).toBe('5583999990000');
        expect(buildCompanyShareLinks(company)).toContainEqual(expect.objectContaining({
            id: 'whatsapp',
            url: 'https://wa.me/5583999990000',
        }));
    });

    it('monta links válidos mesmo quando site e redes foram cadastrados sem protocolo', () => {
        const links = buildCompanyShareLinks(company);

        expect(links).toContainEqual(expect.objectContaining({ id: 'site', url: 'https://windowfilm.br' }));
        expect(links).toContainEqual(expect.objectContaining({ id: 'instagram', url: 'https://instagram.com/windowfilm.br' }));
        expect(links).toContainEqual(expect.objectContaining({ id: 'facebook', url: 'https://facebook.com/windowfilmbr' }));
        expect(links).toContainEqual(expect.objectContaining({ id: 'tiktok', display: '@windowfilmbr' }));
        expect(getCompanyPrimaryShareUrl(company)).toBe('https://windowfilm.br');
    });

    it('gera mensagem com nome, apresentação e canais da empresa', () => {
        const text = buildCompanyShareText(company);

        expect(text).toContain('✨ Window Film BR');
        expect(text).toContain('Atendimento profissional, qualidade e confiança');
        expect(text).toContain('WhatsApp: https://wa.me/5583999990000');
        expect(text).toContain('Instagram: https://instagram.com/windowfilm.br');
        expect(text).toContain('Localização: https://www.google.com/maps/search/');
    });
});
