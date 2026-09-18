import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Client, SavedPDF } from '../../types';
import { previewProposalFollowUp } from '../../src/lib/proposalFollowUp';
import { applyProposalFollowUp } from '../../services/proposalFollowUp';

vi.mock('../../services/proposalFollowUp', () => ({ applyProposalFollowUp: vi.fn() }));

vi.mock('../../services/supabaseDb', () => ({
    getProposalMessageTemplates: vi.fn().mockResolvedValue([
        {
            id: 1,
            title: 'Enviar proposta',
            text: 'Oi, {{primeiro_nome}}. Acabei de preparar sua proposta. O valor final ficou em {{valor_final}}.',
            sortOrder: 0,
        },
    ]),
    saveProposalMessageTemplate: vi.fn().mockResolvedValue({
        id: 99,
        title: 'Meu modelo',
        text: 'Olá {{primeiro_nome}}',
        sortOrder: 1,
    }),
    deleteProposalMessageTemplate: vi.fn().mockResolvedValue(undefined),
}));

import ProposalMessagesModal from './ProposalMessagesModal';
import { saveProposalMessageTemplate } from '../../services/supabaseDb';

const client: Client = {
    id: 1,
    nome: 'Alex Perin',
    telefone: '(83) 99647-6052',
    email: '',
    cpfCnpj: '',
};

const pdf: SavedPDF = {
    id: 10,
    clienteId: 1,
    date: '2026-07-03T12:00:00.000Z',
    totalPreco: 4799.6,
    totalM2: 10,
    nomeArquivo: 'orcamento-alex.pdf',
    proposalOptionName: 'Opção 1',
};

describe('ProposalMessagesModal', () => {
    beforeEach(() => {
        vi.mocked(applyProposalFollowUp).mockReset();
        vi.mocked(applyProposalFollowUp).mockImplementation(async (proposal, _client, raw, type) => ({
            ...previewProposalFollowUp(proposal, raw, type), followUpRevision: (proposal.followUpRevision || 0) + 1,
        }));
    });

    it('mostra preview, pede confirmação e persiste antes de abrir WhatsApp', async () => {
        const reported = { ...pdf, subtotal: 2032.80, totalPreco: 1890.50 };
        render(<ProposalMessagesModal isOpen client={client} pdf={reported} onClose={vi.fn()} />);
        await screen.findByRole('button', { name: 'Enviar no WhatsApp' });
        fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '20' } });
        expect(screen.getAllByText(/1\.512,40/).length).toBeGreaterThan(0);
        expect(applyProposalFollowUp).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Enviar no WhatsApp' }));
        expect(screen.getByText(/Aplicar 20% nesta proposta/)).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /WhatsApp do celular/i })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar desconto' }));
        const link = await screen.findByRole('link', { name: /WhatsApp do celular/i });
        expect(applyProposalFollowUp).toHaveBeenCalledWith(reported, client, '20', 'percentage');
        expect(decodeURIComponent(link.getAttribute('href')!)).toContain('1.512,40');
    });

    it('abre link com o valor salvo e restaura 1.890,50 quando o campo fica vazio', async () => {
        const reported = { ...pdf, subtotal: 2032.80, totalPreco: 1890.50 };
        const discounted = { ...previewProposalFollowUp(reported, '20', 'percentage'), followUpRevision: 1 };
        render(<ProposalMessagesModal isOpen client={client} pdf={discounted} onClose={vi.fn()} />);
        expect(screen.getByRole('spinbutton')).toHaveValue(20);
        fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } });
        fireEvent.click(screen.getByRole('button', { name: 'Criar link interativo da proposta' }));
        expect(screen.getByText(/Remover o desconto/)).toHaveTextContent(/1\.890,50/);
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar desconto' }));
        await screen.findByRole('button', { name: 'Criar link da proposta' });
        expect(screen.getAllByText(/1\.890,50/).length).toBeGreaterThan(0);
        expect(applyProposalFollowUp).toHaveBeenCalledWith(discounted, client, '', 'percentage');
    });

    it('cancelar ou falhar ao salvar não abre o envio', async () => {
        render(<ProposalMessagesModal isOpen client={client} pdf={pdf} onClose={vi.fn()} />);
        await screen.findByRole('button', { name: 'Enviar no WhatsApp' });
        fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '20' } });
        fireEvent.click(screen.getByRole('button', { name: 'Enviar no WhatsApp' }));
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(applyProposalFollowUp).not.toHaveBeenCalled();
        vi.mocked(applyProposalFollowUp).mockRejectedValueOnce(new Error('Falha ao salvar o PDF'));
        fireEvent.click(screen.getByRole('button', { name: 'Enviar no WhatsApp' }));
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar desconto' }));
        expect(await screen.findByText('Falha ao salvar o PDF')).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /WhatsApp do celular/i })).not.toBeInTheDocument();
    });
    it('oferece WhatsApp comum e WhatsApp Business com a mensagem preenchida', async () => {
        render(<ProposalMessagesModal isOpen client={client} pdf={pdf} onClose={vi.fn()} />);

        fireEvent.click(await screen.findByRole('button', { name: 'Enviar no WhatsApp' }));

        const appLink = screen.getByRole('link', { name: /WhatsApp do celular/i });
        const businessLink = screen.getByRole('link', { name: /WhatsApp Business/i });

        expect(appLink).toHaveAttribute('href', expect.stringContaining('whatsapp://send?phone=5583996476052'));
        expect(appLink).toHaveAttribute('href', expect.stringContaining('Acabei%20de%20preparar%20sua%20proposta'));
        expect(businessLink).toHaveAttribute('href', expect.stringContaining('https://wa.me/5583996476052'));
        expect(screen.getByText(/não será enviada automaticamente/i)).toBeInTheDocument();
    });

    it('cria um novo modelo pelo editor em tela cheia', async () => {
        render(<ProposalMessagesModal isOpen client={client} pdf={pdf} onClose={vi.fn()} />);

        // Espera os modelos carregarem e abre o editor pelo botão "+".
        await screen.findByRole('button', { name: 'Enviar no WhatsApp' });
        fireEvent.click(screen.getByRole('button', { name: 'Criar novo modelo' }));

        const nameInput = await screen.findByPlaceholderText('Ex.: Enviar proposta');
        fireEvent.change(nameInput, { target: { value: 'Meu modelo' } });
        fireEvent.change(screen.getByPlaceholderText(/Escreva o texto da mensagem/i), {
            target: { value: 'Olá {{primeiro_nome}}' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Criar modelo' }));

        await waitFor(() =>
            expect(saveProposalMessageTemplate).toHaveBeenCalledWith(
                expect.objectContaining({ title: 'Meu modelo', text: 'Olá {{primeiro_nome}}' })
            )
        );
    });
});
