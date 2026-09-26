import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client, SavedPDF } from '../../types';
import { createProposalPortal, findClientProposalPortals, refreshProposalPortal, revokeProposalPortal, type ExistingProposalPortal } from '../../src/lib/proposalPortal';
import ProposalShareModal from './ProposalShareModal';

vi.mock('../../src/lib/proposalPortal', () => ({
    createProposalPortal: vi.fn(),
    findClientProposalPortals: vi.fn(),
    refreshProposalPortal: vi.fn(),
    revokeProposalPortal: vi.fn(),
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
        vi.mocked(findClientProposalPortals).mockReset().mockResolvedValue([]);
        vi.mocked(refreshProposalPortal).mockReset();
        vi.mocked(revokeProposalPortal).mockReset().mockResolvedValue(undefined);
        vi.mocked(createProposalPortal).mockResolvedValue({
            portalId: 'portal-1', token: 'abc123', shareCode: 'abc123',
            expiresAt: '2026-10-21T23:59:59Z', url: portalUrl,
        });
    });

    it('oferece WhatsApp comum e Business com o mesmo link criado', async () => {
        render(<ProposalShareModal isOpen client={client} pdfs={[pdf]} onClose={vi.fn()} />);
        fireEvent.click(await screen.findByRole('button', { name: /Criar link da proposta/i }));
        await screen.findByText('Link criado com sucesso');

        fireEvent.click(screen.getByRole('button', { name: 'Enviar no WhatsApp' }));
        const appLink = screen.getByRole('link', { name: /WhatsApp do celular/i });
        const businessLink = screen.getByRole('link', { name: /WhatsApp Business/i });

        expect(appLink).toHaveAttribute('href', expect.stringContaining('whatsapp://send?phone=5583996476052'));
        expect(businessLink).toHaveAttribute('href', expect.stringContaining('https://wa.me/5583996476052'));
        expect(decodeURIComponent(appLink.getAttribute('href') || '')).toContain(portalUrl);
        expect(decodeURIComponent(businessLink.getAttribute('href') || '')).toContain(portalUrl);
    });

    it('envia a mensagem pronta escolhida já com o link', async () => {
        render(<ProposalShareModal isOpen client={client} pdfs={[pdf]} onClose={vi.fn()}
            messageOptions={['Oi Camila, segue seu orçamento com Blackout.', 'Camila, orçamento aqui: {{link}} (até {{validade}})']} />);
        fireEvent.click(await screen.findByRole('button', { name: /Criar link da proposta/i }));
        await screen.findByText('Link criado com sucesso');

        fireEvent.click(screen.getByRole('button', { name: 'Mensagem pronta 1' }));
        const textarea = screen.getByRole('textbox', { name: 'Mensagem que será enviada' }) as HTMLTextAreaElement;
        expect(textarea.value).toContain('Oi Camila, segue seu orçamento com Blackout.');
        expect(textarea.value).toContain(portalUrl);

        fireEvent.click(screen.getByRole('button', { name: 'Mensagem pronta 2' }));
        expect(textarea.value).toBe(`Camila, orçamento aqui: ${portalUrl} (até ${new Date('2026-10-21T23:59:59Z').toLocaleDateString('pt-BR')})`);

        fireEvent.change(textarea, { target: { value: 'Mensagem sem link' } });
        expect(screen.getByText('O link não está mais na mensagem.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Refazer' }));
        expect(textarea.value).toContain(portalUrl);

        fireEvent.click(screen.getByRole('button', { name: 'Enviar no WhatsApp' }));
        const appLink = screen.getByRole('link', { name: /WhatsApp do celular/i });
        expect(decodeURIComponent(appLink.getAttribute('href') || '')).toContain('Camila, orçamento aqui:');
    });

    it('não oferece envio sem telefone do cliente', async () => {
        render(<ProposalShareModal isOpen client={{ ...client, telefone: '' }} pdfs={[pdf]} onClose={vi.fn()} />);
        fireEvent.click(await screen.findByRole('button', { name: /Criar link da proposta/i }));
        await screen.findByText('Link criado com sucesso');
        expect(screen.getByRole('button', { name: 'Sem telefone' })).toBeDisabled();
    });

    it('cria automaticamente o link vindo do orçamento recém-gerado', async () => {
        const { rerender } = render(<ProposalShareModal isOpen client={client} pdfs={[pdf]} autoCreate onClose={vi.fn()} />);

        await waitFor(() => expect(createProposalPortal).toHaveBeenCalledTimes(1));
        expect(await screen.findByText('Link criado com sucesso')).toBeInTheDocument();
        expect(screen.getByDisplayValue(portalUrl)).toBeInTheDocument();

        rerender(<ProposalShareModal isOpen client={client} pdfs={[{ ...pdf }]} autoCreate onClose={vi.fn()} />);
        expect(screen.getByText('Link criado com sucesso')).toBeInTheDocument();
        expect(createProposalPortal).toHaveBeenCalledTimes(1);
    });
    const existingPortal = (overrides: Partial<ExistingProposalPortal> = {}): ExistingProposalPortal => ({
        id: 'portal-old',
        url: 'https://app.filmstec.shop/p/camila/old999',
        status: 'active',
        expiresAt: '2026-11-25T23:59:59Z',
        createdAt: '2026-09-20T12:00:00Z',
        expired: false,
        viewCount: 3,
        lastViewedAt: null,
        proposals: [{ id: 42, name: 'Opção 2', total: 558.7 }],
        sameProposals: true,
        updatable: true,
        ...overrides,
    });

    it('mostra o link que já foi enviado em vez de criar outro', async () => {
        vi.mocked(findClientProposalPortals).mockResolvedValue([existingPortal()]);
        render(<ProposalShareModal isOpen client={client} pdfs={[pdf]} autoCreate onClose={vi.fn()} />);

        expect(await screen.findByText('Link já enviado para este cliente')).toBeInTheDocument();
        expect(screen.getByDisplayValue('https://app.filmstec.shop/p/camila/old999')).toBeInTheDocument();
        expect(screen.getByText(/enviado em 20\/09 · aberto 3x · válido até 25\/11/)).toBeInTheDocument();
        expect(createProposalPortal).not.toHaveBeenCalled();

        // Encerrar pede confirmação e volta para criar um novo.
        fireEvent.click(screen.getByRole('button', { name: /Encerrar link/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Encerrar link' }));
        await waitFor(() => expect(revokeProposalPortal).toHaveBeenCalledWith('portal-old'));
        expect(await screen.findByText(/Link encerrado/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Criar link da proposta/i })).toBeInTheDocument();
    });

    it('oferece atualizar o link antigo (mesmo endereço) quando as propostas mudaram', async () => {
        vi.mocked(findClientProposalPortals).mockResolvedValue([existingPortal({ sameProposals: false, proposals: [{ id: 10, name: 'Opção antiga', total: 400 }] })]);
        vi.mocked(refreshProposalPortal).mockResolvedValue({
            portalId: 'portal-old', token: 'old999', shareCode: 'old999',
            expiresAt: '2026-12-01T23:59:59Z', url: 'https://app.filmstec.shop/p/camila/old999',
        });
        render(<ProposalShareModal isOpen client={client} pdfs={[pdf]} autoCreate onClose={vi.fn()} />);

        expect(await screen.findByText('Este cliente já tem um link')).toBeInTheDocument();
        expect(screen.getByText('Opção antiga')).toBeInTheDocument();
        // Não cria sozinho quando já existe um link para atualizar.
        expect(createProposalPortal).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Atualizar o link de 20/09' }));
        await waitFor(() => expect(refreshProposalPortal).toHaveBeenCalledWith('portal-old', [pdf], expect.any(String), 'Camila Soares'));
        expect(await screen.findByText('Link atualizado (mesmo endereço)')).toBeInTheDocument();
        expect(screen.getByDisplayValue('https://app.filmstec.shop/p/camila/old999')).toBeInTheDocument();
    });

    it('prorroga a validade do link já enviado', async () => {
        vi.mocked(findClientProposalPortals).mockResolvedValue([existingPortal()]);
        vi.mocked(refreshProposalPortal).mockResolvedValue({
            portalId: 'portal-old', token: 'old999', shareCode: 'old999',
            expiresAt: '2026-12-20T23:59:59Z', url: 'https://app.filmstec.shop/p/camila/old999',
        });
        render(<ProposalShareModal isOpen client={client} pdfs={[pdf]} onClose={vi.fn()} />);

        fireEvent.click(await screen.findByRole('button', { name: /Alterar validade/ }));
        fireEvent.change(screen.getByLabelText(/Válido até/), { target: { value: '2026-12-20' } });
        fireEvent.click(screen.getByRole('button', { name: /Salvar validade/ }));
        await waitFor(() => expect(refreshProposalPortal).toHaveBeenCalledWith('portal-old', [pdf], '2026-12-20', 'Camila Soares'));
        expect(await screen.findByText(`até ${new Date('2026-12-20T23:59:59Z').toLocaleDateString('pt-BR')}`)).toBeInTheDocument();
    });
});
