import { fireEvent, render, screen } from '@testing-library/react';
import { Client, SavedPDF } from '../../types';
import ProposalMessagesModal from './ProposalMessagesModal';

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
    it('oferece WhatsApp comum e WhatsApp Business com a mensagem preenchida', () => {
        render(<ProposalMessagesModal isOpen client={client} pdf={pdf} onClose={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Enviar no WhatsApp' }));

        const appLink = screen.getByRole('link', { name: /WhatsApp do celular/i });
        const businessLink = screen.getByRole('link', { name: /WhatsApp Business/i });

        expect(appLink).toHaveAttribute('href', expect.stringContaining('whatsapp://send?phone=5583996476052'));
        expect(appLink).toHaveAttribute('href', expect.stringContaining('Acabei%20de%20preparar%20sua%20proposta'));
        expect(businessLink).toHaveAttribute('href', expect.stringContaining('https://wa.me/5583996476052'));
        expect(screen.getByText(/não será enviada automaticamente/i)).toBeInTheDocument();
    });
});
