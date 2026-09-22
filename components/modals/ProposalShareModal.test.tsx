import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client, SavedPDF } from '../../types';
import { createProposalPortal } from '../../src/lib/proposalPortal';
import ProposalShareModal from './ProposalShareModal';

vi.mock('../../src/lib/proposalPortal', () => ({
    createProposalPortal: vi.fn(),
    buildProposalShareMessage: (_client: Client, _pdfs: SavedPDF[], url: string) => `Veja sua proposta: ${url}`,
}));

const client: Client = {
    id: 1,
    nome: 'Camila Soares',
    telefone: '(83) 99647-6052',
    email: '',
    cpfCnpj: '',
};
const pdf = { id: 42, proposalOptionName: 'Opção 2', totalPreco: 558.70 } as SavedPDF;
const portalUrl = 'https://app.filmstec.shop/p/camila/abc123';

describe('ProposalShareModal', () => {
    beforeEach(() => {
        vi.mocked(createProposalPortal).mockReset();
        vi.mocked(createProposalPortal).mockResolvedValue({
            portalId: 'portal-1', token: 'abc123', shareCode: 'abc123',
            expiresAt: '2026-10-21T23:59:59Z', url: portalUrl,
        });
    });

    it('oferece WhatsApp comum e Business com o mesmo link criado', async () => {
        render(<ProposalShareModal isOpen client={client} pdfs={[pdf]} onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /Criar link da proposta/i }));
        await screen.findByText('Link criado com sucesso');

        fireEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));
        const appLink = screen.getByRole('link', { name: /WhatsApp do celular/i });
        const businessLink = screen.getByRole('link', { name: /WhatsApp Business/i });

        expect(appLink).toHaveAttribute('href', expect.stringContaining('whatsapp://send?phone=5583996476052'));
        expect(businessLink).toHaveAttribute('href', expect.stringContaining('https://wa.me/5583996476052'));
        expect(decodeURIComponent(appLink.getAttribute('href') || '')).toContain(portalUrl);
        expect(decodeURIComponent(businessLink.getAttribute('href') || '')).toContain(portalUrl);
    });

    it('não oferece envio sem telefone do cliente', async () => {
        render(<ProposalShareModal isOpen client={{ ...client, telefone: '' }} pdfs={[pdf]} onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /Criar link da proposta/i }));
        await screen.findByText('Link criado com sucesso');
        expect(screen.getByRole('button', { name: 'Sem telefone' })).toBeDisabled();
    });
});
