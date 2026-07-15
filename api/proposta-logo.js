import { fetchProposalPreviewData } from './proposta-preview.js';

const DATA_IMAGE_PATTERN = /^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=\s]+)$/i;

export default async function handler(request, response) {
    const codeValue = Array.isArray(request.query?.code) ? request.query.code[0] : request.query?.code;
    const code = String(codeValue || '').trim().slice(0, 96);

    try {
        const preview = await fetchProposalPreviewData(code);
        const logo = String(preview?.companyLogo || '');
        const dataImage = logo.match(DATA_IMAGE_PATTERN);

        if (dataImage) {
            const image = Buffer.from(dataImage[2].replace(/\s/g, ''), 'base64');
            if (image.byteLength > 1_500_000) throw new Error('Logo acima do limite permitido.');
            response.setHeader('Content-Type', dataImage[1].toLowerCase());
            response.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
            return response.status(200).end(image);
        }

        const externalLogo = new URL(logo);
        if (externalLogo.protocol === 'https:' || externalLogo.protocol === 'http:') {
            return response.redirect(307, externalLogo.toString());
        }
        throw new Error('Logo indisponível.');
    } catch (error) {
        console.error('[proposta-logo]', error);
        return response.redirect(307, '/icon-512x512.png');
    }
}

