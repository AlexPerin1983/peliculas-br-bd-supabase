import { fireEvent, render, screen } from '@testing-library/react';
import AgendaView from './AgendaView';
import { Agendamento, Client } from '../../types';

const appointmentDate = '2026-05-24T12:00:00.000Z';

const clientWithAddress: Client = {
    id: 1,
    nome: 'Cliente Mapa',
    telefone: '(83) 99999-0000',
    email: '',
    cpfCnpj: '',
    logradouro: 'Rua das Peliculas',
    numero: '123',
    bairro: 'Centro',
    cidade: 'Joao Pessoa',
    uf: 'PB',
};

const appointment: Agendamento = {
    id: 1,
    clienteId: 1,
    clienteNome: 'Cliente Mapa',
    start: appointmentDate,
    end: '2026-05-24T14:00:00.000Z',
};

const renderAgenda = (clients: Client[] = [clientWithAddress], agendamentos: Agendamento[] = [appointment]) => render(
    <AgendaView
        agendamentos={agendamentos}
        pdfs={[]}
        clients={clients}
        onEditAgendamento={vi.fn()}
        onUpdateServiceStatus={vi.fn()}
        onCompleteAgendamentoWithValue={vi.fn()}
        onContinueAgendamento={vi.fn()}
        onRescheduleAgendamento={vi.fn()}
        onCreateNewAgendamento={vi.fn()}
    />
);

describe('AgendaView', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(appointmentDate));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('mostra link de navegacao quando o cliente tem endereco', () => {
        renderAgenda();

        const navigationLinks = screen.getAllByRole('link', { name: /navegar até endereço de cliente mapa/i });

        expect(navigationLinks.length).toBeGreaterThan(0);
        expect(navigationLinks[0]).toHaveAttribute(
            'href',
            expect.stringContaining('https://www.google.com/maps/dir/?api=1')
        );
        expect(navigationLinks[0]).toHaveAttribute(
            'href',
            expect.stringContaining('destination=Rua%20das%20Peliculas')
        );
    });

    it('mostra acoes de contato quando o cliente tem telefone', () => {
        renderAgenda();

        const callLinks = screen.getAllByRole('link', { name: /ligar para cliente mapa/i });
        const whatsappButtons = screen.getAllByRole('button', { name: /abrir whatsapp de cliente mapa/i });

        expect(callLinks[0]).toHaveAttribute('href', 'tel:83999990000');
        expect(whatsappButtons.length).toBeGreaterThan(0);
    });

    it('abre escolha entre WhatsApp e WhatsApp Business ao clicar no contato', () => {
        renderAgenda();

        const whatsappButtons = screen.getAllByRole('button', { name: /abrir whatsapp de cliente mapa/i });
        fireEvent.click(whatsappButtons[0]);

        const regularLink = screen.getByRole('link', { name: /^whatsapp$/i });
        const businessLink = screen.getByRole('link', { name: /whatsapp business/i });

        expect(regularLink).toHaveAttribute('href', 'https://wa.me/5583999990000');
        expect(businessLink).toHaveAttribute('href', 'https://wa.me/5583999990000');
    });

    it('nao mostra link de navegacao sem endereco do cliente', () => {
        renderAgenda([
            {
                id: 1,
                nome: 'Cliente Mapa',
                telefone: '',
                email: '',
                cpfCnpj: '',
            }
        ]);

        expect(screen.queryByRole('link', { name: /navegar ate endereco/i })).not.toBeInTheDocument();
    });
});
