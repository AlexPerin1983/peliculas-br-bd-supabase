import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Client, SavedPDF } from '../../types';

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
