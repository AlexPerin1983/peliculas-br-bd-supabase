const DEFAULT_SUPABASE_URL = 'https://avlefzsipbqvollukgyt.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2bGVmenNpcGJxdm9sbHVrZ3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3Nzc0MjUsImV4cCI6MjA4MjM1MzQyNX0.mXiqnxe9reQNwuAjZ6yFfm1AR1Qcdib3EjXCaG9EonM';

export const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const firstName = (name = 'Cliente') => name.trim().split(/\s+/)[0] || 'Cliente';

export const resolvePreviewImage = (logo, origin, shareCode = '') => {
    if (String(logo || '').startsWith('data:image/') && shareCode) {
        return `${origin}/api/proposta-logo?code=${encodeURIComponent(shareCode)}`;
    }
    try {
        const candidate = new URL(String(logo || ''), origin);
        if (candidate.protocol === 'https:' || candidate.protocol === 'http:') return candidate.toString();
    } catch {
        // Usa o icone publico quando a logo cadastrada nao e uma URL acessivel.
    }
    return `${origin}/icon-512x512.png`;
};

export const injectProposalPreview = (html, preview, pageUrl, origin) => {
    const client = firstName(preview?.clientName);
    const company = preview?.companyName || 'Películas Brasil';
    const expiresAt = preview?.expiresAt ? new Date(preview.expiresAt) : null;
    const validDate = expiresAt && !Number.isNaN(expiresAt.getTime())
        ? expiresAt.toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza' })
        : '';
    const title = `Proposta para ${client} | ${company}`;
    const description = validDate
        ? `Sua proposta da ${company} está pronta. Disponível até ${validDate}.`
        : `Sua proposta da ${company} está pronta para você visualizar.`;
    const shareCode = decodeURIComponent(new URL(pageUrl).pathname.split('/').filter(Boolean).pop() || '');
    const image = resolvePreviewImage(preview?.companyLogo, origin, shareCode);
    const meta = [
        `<title>${escapeHtml(title)}</title>`,
        `<meta name="description" content="${escapeHtml(description)}">`,
        '<meta property="og:type" content="website">',
        `<meta property="og:title" content="${escapeHtml(title)}">`,
        `<meta property="og:description" content="${escapeHtml(description)}">`,
        `<meta property="og:image" content="${escapeHtml(image)}">`,
        `<meta property="og:url" content="${escapeHtml(pageUrl)}">`,
        '<meta property="og:locale" content="pt_BR">',
        '<meta name="twitter:card" content="summary_large_image">',
        `<meta name="twitter:title" content="${escapeHtml(title)}">`,
        `<meta name="twitter:description" content="${escapeHtml(description)}">`,
        `<meta name="twitter:image" content="${escapeHtml(image)}">`,
    ].join('\n  ');

    return html
        .replace(/<title>[\s\S]*?<\/title>/i, '')
        .replace(/<meta\s+name=["']description["'][^>]*>/i, '')
        .replace('</head>', `  ${meta}\n</head>`);
};

export const fetchProposalPreviewData = async (shareCode) => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
    const response = await fetch(`${supabaseUrl}/functions/v1/proposal-portal`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ action: 'preview', shareCode }),
    });
    if (!response.ok) throw new Error(`Preview indisponível (${response.status})`);
    return response.json();
};

export default async function handler(request, response) {
    const codeValue = Array.isArray(request.query?.code) ? request.query.code[0] : request.query?.code;
    const code = String(codeValue || '').trim().slice(0, 96);
    const forwardedProtocol = String(request.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const host = request.headers.host;
    const origin = `${forwardedProtocol}://${host}`;
    const slugValue = Array.isArray(request.query?.slug) ? request.query.slug[0] : request.query?.slug;
    const slug = String(slugValue || 'cliente').trim().slice(0, 80);
    const pageUrl = `${origin}/p/${encodeURIComponent(slug)}/${encodeURIComponent(code)}`;

    try {
        const [htmlResponse, preview] = await Promise.all([
            fetch(`${origin}/index.html`, { headers: { 'User-Agent': 'proposal-preview-renderer' } }),
            fetchProposalPreviewData(code),
        ]);
        if (!htmlResponse.ok) throw new Error('Aplicação indisponível.');
        const html = await htmlResponse.text();
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
        return response.status(200).send(injectProposalPreview(html, preview, pageUrl, origin));
    } catch (error) {
        console.error('[proposta-preview]', error);
        return response.redirect(307, `/proposta?token=${encodeURIComponent(code)}`);
    }
}

