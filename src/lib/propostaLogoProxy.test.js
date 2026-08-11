import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { decodeProposalLogo, MAX_PROPOSAL_LOGO_BYTES } from '../../api/proposta-logo.js';

describe('proxy da logo da proposta', () => {
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
