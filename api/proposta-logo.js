import { fetchProposalPreviewData } from './proposta-preview.js';
import sharp from 'sharp';

const DATA_IMAGE_PATTERN = /^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=\s]+)$/i;
export const MAX_PROPOSAL_LOGO_BYTES = 4 * 1024 * 1024;
export const PREVIEW_LOGO_SIZE = 600;

export const decodeProposalLogo = (logo) => {
    const dataImage = String(logo || '').match(DATA_IMAGE_PATTERN);
    if (!dataImage) return null;

    const image = Buffer.from(dataImage[2].replace(/\s/g, ''), 'base64');
    if (image.byteLength > MAX_PROPOSAL_LOGO_BYTES) {
        throw new Error('Logo acima do limite permitido.');
    }

    return {
        contentType: dataImage[1].toLowerCase(),
        image,
    };
};

export const optimizeProposalLogo = (image) => sharp(image, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize(PREVIEW_LOGO_SIZE, PREVIEW_LOGO_SIZE, {
        fit: 'contain',
        background: '#ffffff',
    })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();

export default async function handler(request, response) {
    const codeValue = Array.isArray(request.query?.code) ? request.query.code[0] : request.query?.code;
    const code = String(codeValue || '').trim().slice(0, 96);

    try {
        const preview = await fetchProposalPreviewData(code);
        const logo = String(preview?.companyLogo || '');
        const dataImage = decodeProposalLogo(logo);

        if (dataImage) {
            const image = await optimizeProposalLogo(dataImage.image);
            response.setHeader('Content-Type', 'image/jpeg');
            response.setHeader('Content-Length', image.byteLength);
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
