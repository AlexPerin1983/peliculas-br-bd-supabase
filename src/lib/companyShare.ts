import type { UserInfo } from '../../types';

export interface CompanyShareLink {
    id: 'whatsapp' | 'site' | 'email' | 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'reviews' | 'address';
    label: string;
    display: string;
    url: string;
}

type ShareableCompany = Partial<Pick<
    UserInfo,
    'empresa' | 'nome' | 'telefone' | 'email' | 'site' | 'endereco' | 'socialLinks'
>>;

const absoluteUrl = (value?: string): string => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed.replace(/^\/+/, '')}`;
};

const socialUrl = (value: string | undefined, baseUrl: string): string => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/|$)/i.test(trimmed)) return `https://${trimmed}`;
    return `${baseUrl}${trimmed.replace(/^@/, '').replace(/^\/+/, '')}`;
};

const socialDisplay = (value: string): string => {
    try {
        const url = new URL(value);
        const path = decodeURIComponent(url.pathname).replace(/^\/+|\/+$/g, '');
        return path ? `@${path.split('/')[0].replace(/^@/, '')}` : url.hostname.replace(/^www\./, '');
    } catch {
        return value;
    }
};

export const normalizeCompanyPhone = (value?: string): string => {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
        return `55${digits}`;
    }
    return digits;
};

export const getCompanyShareName = (company: ShareableCompany, fallback = 'Minha empresa'): string => (
    String(company.empresa || company.nome || fallback).trim() || fallback
);

export const buildCompanyShareMessage = (company: ShareableCompany, fallbackName?: string): string => (
    `Conheça a ${getCompanyShareName(company, fallbackName)}. Atendimento profissional, qualidade e confiança para cuidar do seu projeto.`
);

export const buildCompanyShareLinks = (company: ShareableCompany): CompanyShareLink[] => {
    const links: CompanyShareLink[] = [];
    const phone = normalizeCompanyPhone(company.telefone);
    const site = absoluteUrl(company.site);
    const instagram = socialUrl(company.socialLinks?.instagram, 'https://instagram.com/');
    const facebook = socialUrl(company.socialLinks?.facebook, 'https://facebook.com/');
    const tiktok = socialUrl(company.socialLinks?.tiktok, 'https://tiktok.com/@');
    const youtube = socialUrl(company.socialLinks?.youtube, 'https://youtube.com/@');
    const reviews = absoluteUrl(company.socialLinks?.googleReviews);

    if (phone) links.push({
        id: 'whatsapp',
        label: 'WhatsApp',
        display: String(company.telefone || phone),
        url: `https://wa.me/${phone}`,
    });
    if (site) links.push({ id: 'site', label: 'Site', display: site.replace(/^https?:\/\//i, '').replace(/\/$/, ''), url: site });
    if (company.email?.trim()) links.push({
        id: 'email',
        label: 'E-mail',
        display: company.email.trim(),
        url: `mailto:${company.email.trim()}`,
    });
    if (instagram) links.push({ id: 'instagram', label: 'Instagram', display: socialDisplay(instagram), url: instagram });
    if (facebook) links.push({ id: 'facebook', label: 'Facebook', display: socialDisplay(facebook), url: facebook });
    if (tiktok) links.push({ id: 'tiktok', label: 'TikTok', display: socialDisplay(tiktok), url: tiktok });
    if (youtube) links.push({ id: 'youtube', label: 'YouTube', display: socialDisplay(youtube), url: youtube });
    if (reviews) links.push({ id: 'reviews', label: 'Avaliações', display: 'Veja nossas avaliações', url: reviews });
    if (company.endereco?.trim()) links.push({
        id: 'address',
        label: 'Localização',
        display: company.endereco.trim(),
        url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(company.endereco.trim())}`,
    });

    return links;
};

export const buildCompanyShareText = (company: ShareableCompany, fallbackName?: string): string => {
    const name = getCompanyShareName(company, fallbackName);
    const links = buildCompanyShareLinks(company);
    const lines = [
        `✨ ${name}`,
        '',
        buildCompanyShareMessage(company, fallbackName),
    ];

    if (links.length) {
        lines.push('', 'Fale com a gente:');
        links.forEach((link) => lines.push(`${link.label}: ${link.url}`));
    }

    return lines.join('\n');
};

export const getCompanyPrimaryShareUrl = (company: ShareableCompany): string | undefined => {
    const links = buildCompanyShareLinks(company);
    return links.find((link) => link.id === 'site')?.url
        || links.find((link) => link.id === 'whatsapp')?.url;
};
