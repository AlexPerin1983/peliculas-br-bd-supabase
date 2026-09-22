import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { decodeProposalLogo, MAX_PROPOSAL_LOGO_BYTES, optimizeProposalLogo, PREVIEW_LOGO_SIZE } from '../../api/proposta-logo.js';

describe('proxy da logo da proposta', () => {
    it('entrega uma miniatura JPEG quadrada e leve, com fundo para logos transparentes', async () => {
        const source = await sharp({ create: {
            width: 1024,
            height: 1024,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        } }).png().toBuffer();

        const thumbnail = await optimizeProposalLogo(source);
        const metadata = await sharp(thumbnail).metadata();

        expect(metadata.format).toBe('jpeg');
        expect(metadata.width).toBe(PREVIEW_LOGO_SIZE);
        expect(metadata.height).toBe(PREVIEW_LOGO_SIZE);
        expect(thumbnail.byteLength).toBeLessThan(100_000);
    });

    it('aceita logos legadas maiores que o limite antigo de 1,5 MB', () => {
        const legacyLogo = Buffer.alloc(1_650_000, 1);
        const dataUrl = `data:image/png;base64,${legacyLogo.toString('base64')}`;

        const decoded = decodeProposalLogo(dataUrl);

        expect(decoded?.contentType).toBe('image/png');
        expect(decoded?.image.byteLength).toBe(legacyLogo.byteLength);
    });

    it('mantem um teto seguro para imagens excessivamente grandes', () => {
        const oversizedLogo = Buffer.alloc(MAX_PROPOSAL_LOGO_BYTES + 1, 1);
        const dataUrl = `data:image/png;base64,${oversizedLogo.toString('base64')}`;

        expect(() => decodeProposalLogo(dataUrl)).toThrow('Logo acima do limite permitido.');
    });
});
