import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WhatsAppTriageModal from './WhatsAppTriageModal';
import { FeedbackProvider } from '../../src/contexts/FeedbackContext';
import * as service from '../../services/whatsappTriageService';
import type { TriageDone, TriageSuggestion } from '../../services/whatsappTriageService';

vi.mock('../../services/whatsappTriageService', () => ({
    decideWhatsAppTriage: vi.fn(),
}));

const pending: TriageSuggestion[] = [
    { id: 1, phone: '5583999998888', name: 'Kleidson', category: 'novo_cliente', confidence: 1, source: 'jev', snippet: 'Coloca adesivo black out em janela?', lastMessageAt: new Date().toISOString() },
    { id: 2, phone: '5581988887777', name: 'Somma Films Recife', category: 'fornecedor', confidence: 0.95, source: 'regra', snippet: 'Vou gerar seu Pix', lastMessageAt: null },
    { id: 3, phone: null, name: 'Glebson', category: 'novo_cliente', confidence: 0.44, source: 'jev', snippet: 'Tem horário?', lastMessageAt: null },
];
const recent: TriageDone[] = [
    { id: 9, phone: '5583977776666', name: 'Ana', category: 'novo_cliente', status: 'auto_approved', decidedAt: new Date().toISOString() },
];

const renderModal = (onChanged = vi.fn()) => {
    render(
        <FeedbackProvider>
            <WhatsAppTriageModal isOpen onClose={vi.fn()} pending={pending} recent={recent} onChanged={onChanged} />
        </FeedbackProvider>
    );
    return onChanged;
};

describe('WhatsAppTriageModal', () => {
    afterEach(() => vi.clearAllMocks());

    it('mostra a sugestão com a chance de acerto, o trecho da conversa e a ação de cada tipo', () => {
        renderModal();
        expect(screen.getByText('Cliente novo · 100% · Jev')).toBeInTheDocument();
        expect(screen.getByText('Fornecedor · 95% · regra do PIX')).toBeInTheDocument();
        expect(screen.getByText('“Coloca adesivo black out em janela?”')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Salvar em Fornecedores/ })).toBeInTheDocument();
        expect(screen.getByText('A IA ficou em dúvida: confira o tipo.')).toBeInTheDocument();
    });

    it('aprova com o nome editado e o tipo trocado e tira o contato da lista', async () => {
        vi.mocked(service.decideWhatsAppTriage).mockResolvedValue({ status: 'approved', category: 'fornecedor', created: true, name: 'Kleidson Vidros' });
        const onChanged = renderModal();
        fireEvent.change(screen.getAllByLabelText('Nome do contato')[0], { target: { value: 'Kleidson Vidros' } });
        fireEvent.change(screen.getAllByLabelText('Tipo')[0], { target: { value: 'fornecedor' } });
        fireEvent.click(screen.getAllByRole('button', { name: /Salvar em Fornecedores/ })[0]);
        await waitFor(() => expect(service.decideWhatsAppTriage).toHaveBeenCalledWith(1, 'approve', 'fornecedor', 'Kleidson Vidros'));
        await waitFor(() => expect(screen.queryByDisplayValue('Kleidson Vidros')).not.toBeInTheDocument());
        expect(onChanged).toHaveBeenCalled();
        expect(await screen.findByText('Kleidson Vidros foi salvo em Fornecedores.')).toBeInTheDocument();
    });

    it('confirma amigos e família sem pedir nome e descarta sem salvar nada', async () => {
        vi.mocked(service.decideWhatsAppTriage).mockResolvedValue({ status: 'approved', category: 'pessoal' });
        renderModal();
        fireEvent.change(screen.getAllByLabelText('Tipo')[0], { target: { value: 'pessoal' } });
        fireEvent.click(screen.getByRole('button', { name: /Confirmar: amigos e família/ }));
        await waitFor(() => expect(service.decideWhatsAppTriage).toHaveBeenCalledWith(1, 'approve', 'pessoal', 'Kleidson'));

        vi.mocked(service.decideWhatsAppTriage).mockResolvedValue({ status: 'discarded' });
        fireEvent.click(screen.getAllByRole('button', { name: /Descartar/ })[0]);
        await waitFor(() => expect(service.decideWhatsAppTriage).toHaveBeenLastCalledWith(2, 'discard', 'fornecedor', 'Somma Films Recife'));
    });

    it('sem o número não deixa cadastrar e mostra o erro do servidor na própria sugestão', async () => {
        vi.mocked(service.decideWhatsAppTriage).mockRejectedValue(new Error('Este contato já foi revisado'));
        renderModal();
        const approveButtons = screen.getAllByRole('button', { name: /Salvar como cliente/ });
        expect(approveButtons[1]).toBeDisabled();
        expect(screen.getByText('O WhatsApp escondeu o número. Salve o contato no celular para poder cadastrar.')).toBeInTheDocument();
        fireEvent.click(approveButtons[0]);
        expect(await screen.findByRole('alert')).toHaveTextContent('Este contato já foi revisado');
    });

    it('a aba Feitos mostra o que o painel salvou sozinho', () => {
        renderModal();
        fireEvent.click(screen.getByRole('tab', { name: /Feitos/ }));
        expect(screen.getByText(/Salvo como cliente \(pelo painel, sozinho\)/)).toBeInTheDocument();
    });
});
