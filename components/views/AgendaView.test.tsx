import { fireEvent, render, screen, within } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgendaView from './AgendaView';
import { Agendamento, Client, SavedPDF } from '../../types';

const estoqueMocks = vi.hoisted(() => ({
    getAllBobinas: vi.fn(),
}));

vi.mock('../../contexts/SubscriptionContext', () => ({
    useSubscription: () => ({ canUseEstoque: true }),
}));

vi.mock('../../services/estoqueDb', () => ({
    getAllBobinas: estoqueMocks.getAllBobinas,
}));

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

const renderAgenda = (
    clients: Client[] = [clientWithAddress],
    agendamentos: Agendamento[] = [appointment],
    pdfs: SavedPDF[] = [],
    onCompleteAgendamentoWithValue = vi.fn().mockResolvedValue(true),
) => render(
    <AgendaView
        agendamentos={agendamentos}
        pdfs={pdfs}
        clients={clients}
        onEditAgendamento={vi.fn()}
        onUpdateServiceStatus={vi.fn()}
        onSaveReceiptDescription={vi.fn().mockResolvedValue(undefined)}
        onCompleteAgendamentoWithValue={onCompleteAgendamentoWithValue}
        onContinueAgendamento={vi.fn()}
        onRescheduleAgendamento={vi.fn()}
        onCreateNewAgendamento={vi.fn()}
    />
);

describe('AgendaView', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(appointmentDate));
        estoqueMocks.getAllBobinas.mockResolvedValue([{
            id: 8,
            filmId: 'Carbono Prime',
            codigoQr: 'BOB-8',
            larguraCm: 152,
            comprimentoTotalM: 30,
            comprimentoRestanteM: 20,
            status: 'ativa',
        }]);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('mostra o tipo e o título do agendamento no card', () => {
        renderAgenda([clientWithAddress], [{ ...appointment, eventType: 'consulta', title: 'Medir a sala' }]);

        // Os cartões completos (a faixa do próximo atendimento é resumida).
        const cards = screen.getAllByRole('article').filter((card) => !within(card).queryByText('Próximo'));
        expect(cards.length).toBeGreaterThan(0);
        cards.forEach((card) => {
            expect(within(card).getByText('Consulta')).toBeInTheDocument();
            expect(within(card).getByText('Medir a sala')).toBeInTheDocument();
        });
    });

    it('pinta os pontinhos do calendário com a cor do tipo e apaga cancelado', () => {
        renderAgenda([clientWithAddress], [
            { ...appointment, id: 1, clienteNome: 'Ana', eventType: 'consulta' },
            { ...appointment, id: 2, clienteNome: 'Bruno', eventType: 'instalacao', serviceStatus: 'cancelled' },
        ]);

        const consulta = screen.getAllByTitle('Ana · Consulta')[0];
        expect(consulta).toHaveStyle({ backgroundColor: '#7c3aed' });
        expect(consulta).not.toHaveClass('opacity-35');
        const cancelado = screen.getAllByTitle('Bruno · Instalação')[0];
        expect(cancelado).toHaveStyle({ backgroundColor: '#0891b2' });
        expect(cancelado).toHaveClass('opacity-35');

        // A legenda explica as cores dos tipos; "Sem tipo" só aparece quando há agendamento antigo.
        expect(screen.getAllByText('Instalação').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Variado').length).toBeGreaterThan(0);
        expect(screen.queryByText('Sem tipo')).not.toBeInTheDocument();
        expect(screen.queryByText('Agendado')).not.toBeInTheDocument();
    });

    it('cartão sem repetir: sem duração nem contagem, propostas separadas por "·"', () => {
        const pdfs = [
            { id: 10, clienteId: 1, date: appointmentDate, totalPreco: 200, totalM2: 2, nomeArquivo: 'a.pdf', proposalOptionName: 'Residencial' },
            { id: 11, clienteId: 1, date: appointmentDate, totalPreco: 180, totalM2: 1, nomeArquivo: 'b.pdf', proposalOptionName: 'Comercial' },
        ] as SavedPDF[];
        renderAgenda([clientWithAddress], [{ ...appointment, pdfId: 10, pdfIds: [10, 11] }], pdfs);

        expect(screen.getAllByText('Residencial · Comercial').length).toBeGreaterThan(0);
        expect(screen.queryByText(/2 propostas/)).not.toBeInTheDocument();
        expect(screen.queryByText('2h')).not.toBeInTheDocument();
    });

    it('sem as propostas carregadas, mostra quantas estão ligadas', () => {
        renderAgenda([clientWithAddress], [{ ...appointment, pdfId: 10, pdfIds: [10, 11] }], []);
        expect(screen.getAllByText('2 propostas').length).toBeGreaterThan(0);
    });

    it('dia seguinte de um atendimento mostra o selo de continuação no lugar do aviso', () => {
        renderAgenda([clientWithAddress], [{ ...appointment, notes: 'Continuação do atendimento de 23/05.\n\nLevar escada' }]);

        expect(screen.getAllByText('Continuação · 23/05').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Levar escada').length).toBeGreaterThan(0);
        expect(screen.queryByText(/Continuação do atendimento/)).not.toBeInTheDocument();
    });

    it('agendamento antigo, sem tipo, fica só no contorno e entra na legenda', () => {
        renderAgenda();

        const semTipo = screen.getAllByTitle('Cliente Mapa')[0];
        expect(semTipo).toHaveClass('border-slate-400');
        expect(semTipo.getAttribute('style')).toBeNull();
        expect(screen.getAllByText('Sem tipo').length).toBeGreaterThan(0);
    });

    it('oferece agendar por voz ao lado do novo agendamento', () => {
        const onCreateAgendamentoByVoice = vi.fn();
        render(
            <AgendaView
                agendamentos={[appointment]}
                pdfs={[]}
                clients={[clientWithAddress]}
                onEditAgendamento={vi.fn()}
                onUpdateServiceStatus={vi.fn()}
                onSaveReceiptDescription={vi.fn().mockResolvedValue(undefined)}
                onCompleteAgendamentoWithValue={vi.fn().mockResolvedValue(true)}
                onContinueAgendamento={vi.fn()}
                onRescheduleAgendamento={vi.fn()}
                onCreateNewAgendamento={vi.fn()}
                onCreateAgendamentoByVoice={onCreateAgendamentoByVoice}
            />
        );

        const voiceButtons = screen.getAllByRole('button', { name: 'Agendar por voz' });
        expect(voiceButtons.length).toBeGreaterThan(0);
        fireEvent.click(voiceButtons[0]);
        expect(onCreateAgendamentoByVoice).toHaveBeenCalledTimes(1);
    });

    it('escreve a data como se escreve e resume o dia numa linha', () => {
        renderAgenda();

        expect(screen.getAllByText('Domingo, 24 de maio').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Maio de 2026').length).toBeGreaterThan(0);
        expect(screen.getAllByText('1 atendimento').length).toBeGreaterThan(0);
        expect(screen.queryByText('Janela')).not.toBeInTheDocument();
    });

    it('dia vazio oferece agendar por voz', () => {
        const onCreateAgendamentoByVoice = vi.fn();
        render(
            <AgendaView
                agendamentos={[]}
                pdfs={[]}
                clients={[clientWithAddress]}
                onEditAgendamento={vi.fn()}
                onUpdateServiceStatus={vi.fn()}
                onSaveReceiptDescription={vi.fn().mockResolvedValue(undefined)}
                onCompleteAgendamentoWithValue={vi.fn().mockResolvedValue(true)}
                onContinueAgendamento={vi.fn()}
                onRescheduleAgendamento={vi.fn()}
                onCreateNewAgendamento={vi.fn()}
                onCreateAgendamentoByVoice={onCreateAgendamentoByVoice}
            />
        );

        fireEvent.click(screen.getAllByText('Agendar por voz')[0]);
        expect(onCreateAgendamentoByVoice).toHaveBeenCalledTimes(1);
    });

    it('Semana lista a semana inteira, com os dias livres e atalho para agendar', () => {
        window.localStorage.setItem('peliculas-br-agenda-view-mode-v1', 'week');
        const onCreateNewAgendamento = vi.fn();
        try {
            render(
                <AgendaView
                    agendamentos={[
                        { ...appointment, id: 1, clienteNome: 'Ana' },
                        { ...appointment, id: 2, clienteNome: 'Bruno', start: '2026-05-27T12:00:00.000Z', end: '2026-05-27T14:00:00.000Z' },
                    ]}
                    pdfs={[]}
                    clients={[clientWithAddress]}
                    onEditAgendamento={vi.fn()}
                    onUpdateServiceStatus={vi.fn()}
                    onSaveReceiptDescription={vi.fn().mockResolvedValue(undefined)}
                    onCompleteAgendamentoWithValue={vi.fn().mockResolvedValue(true)}
                    onContinueAgendamento={vi.fn()}
                    onRescheduleAgendamento={vi.fn()}
                    onCreateNewAgendamento={onCreateNewAgendamento}
                />
            );

            expect(screen.getByText('Atendimentos da semana')).toBeInTheDocument();
            expect(screen.getByText('2 agendamentos')).toBeInTheDocument();
            // Domingo (hoje) e quarta têm atendimento; os outros 5 dias aparecem livres.
            expect(screen.getAllByText('Bruno').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Livre')).toHaveLength(5);

            fireEvent.click(screen.getByRole('button', { name: 'Agendar para amanhã' }));
            const day = onCreateNewAgendamento.mock.calls[0][0] as Date;
            expect(day.getDate()).toBe(25);
        } finally {
            window.localStorage.removeItem('peliculas-br-agenda-view-mode-v1');
        }
    });

    it('acima da data mostra Hoje, Amanhã e, nos outros dias, Agenda', () => {
        window.localStorage.setItem('peliculas-br-agenda-view-mode-v1', 'day');
        try {
            renderAgenda();
            expect(screen.queryByText('Agenda:')).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Próximo dia' }));
            expect(screen.getAllByText('Amanhã').length).toBeGreaterThan(0);

            fireEvent.click(screen.getByRole('button', { name: 'Próximo dia' }));
            expect(screen.getAllByText('Agenda:').length).toBeGreaterThan(0);

            fireEvent.click(screen.getByRole('button', { name: 'Dia anterior' }));
            fireEvent.click(screen.getByRole('button', { name: 'Dia anterior' }));
            fireEvent.click(screen.getByRole('button', { name: 'Dia anterior' }));
            expect(screen.getAllByText('Ontem').length).toBeGreaterThan(0);
        } finally {
            window.localStorage.removeItem('peliculas-br-agenda-view-mode-v1');
        }
    });

    it('próximo atendimento é uma faixa compacta com WhatsApp e rota', () => {
        vi.setSystemTime(new Date('2026-05-24T09:30:00.000Z'));
        renderAgenda([clientWithAddress], [{ ...appointment, title: 'Medir a sala' }]);

        const strip = screen.getAllByRole('article').find((card) => within(card).queryByText('Próximo'))!;
        expect(within(strip).getByText('Em 2h30')).toBeInTheDocument();
        expect(within(strip).getByText('Cliente Mapa')).toBeInTheDocument();
        expect(within(strip).getByText(/Medir a sala$/)).toBeInTheDocument();
        expect(within(strip).getByRole('button', { name: /abrir whatsapp de cliente mapa/i })).toBeInTheDocument();
        expect(within(strip).getByRole('link', { name: /navegar até endereço de cliente mapa/i })).toBeInTheDocument();
        expect(within(strip).queryByRole('link', { name: /ligar para/i })).not.toBeInTheDocument();
    });

    it('sem a acao de voz nao mostra o microfone', () => {
        renderAgenda();
        expect(screen.queryByRole('button', { name: 'Agendar por voz' })).not.toBeInTheDocument();
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

    it('abre o WhatsApp ao clicar no contato (Business so aparece no mobile)', () => {
        renderAgenda();

        const whatsappButtons = screen.getAllByRole('button', { name: /abrir whatsapp de cliente mapa/i });
        fireEvent.click(whatsappButtons[0]);

        const regularLink = screen.getByRole('link', { name: /^whatsapp$/i });
        expect(regularLink).toHaveAttribute('href', 'https://wa.me/5583999990000');

        // No desktop (jsdom = UA nao-mobile) o WhatsApp Business nao e exibido.
        expect(screen.queryByRole('link', { name: /whatsapp business/i })).not.toBeInTheDocument();
    });

    it('ações do cartão numa linha só: Ligar, WhatsApp e Rota', () => {
        renderAgenda();

        const route = screen.getAllByRole('link', { name: /navegar até endereço de cliente mapa/i }).find((link) => link.textContent === 'Rota')!;
        expect(route).toHaveTextContent(/^Rota$/);
        const actions = route.parentElement!;
        expect(actions).toHaveClass('flex');
        expect(actions.children).toHaveLength(3);
    });

    it('WhatsApp do cartão já vem com a confirmação do atendimento, editável', () => {
        renderAgenda([clientWithAddress], [{
            ...appointment, eventType: 'instalacao', start: '2026-05-25T12:00:00.000Z', end: '2026-05-25T14:00:00.000Z',
        }]);

        fireEvent.click(screen.getAllByRole('button', { name: /abrir whatsapp de cliente mapa/i })[0]);

        const message = screen.getByLabelText('Mensagem de confirmação') as HTMLTextAreaElement;
        expect(message.value).toMatch(/^Olá, Cliente! Confirmando a instalação amanhã, segunda \(25\/05\), às \d{2}:00\. Qualquer dúvida, é só chamar\.$/);
        expect(screen.getByRole('link', { name: /^whatsapp$/i }).getAttribute('href')).toContain('?text=Ol%C3%A1%2C%20Cliente!%20Confirmando');

        fireEvent.change(message, { target: { value: 'Oi! Tudo certo para amanhã?' } });
        expect(screen.getByRole('link', { name: /^whatsapp$/i })).toHaveAttribute('href', `https://wa.me/5583999990000?text=${encodeURIComponent('Oi! Tudo certo para amanhã?')}`);

        // Apagando tudo, abre a conversa sem mensagem.
        fireEvent.change(message, { target: { value: '' } });
        expect(screen.getByRole('link', { name: /^whatsapp$/i })).toHaveAttribute('href', 'https://wa.me/5583999990000');
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

    it('permite gerar recibo somente para atendimento concluido com valor', () => {
        renderAgenda([clientWithAddress], [{ ...appointment, serviceStatus: 'completed', valorFinal: 380 }]);

        const receiptButtons = screen.getAllByRole('button', { name: /gerar recibo do servi/i });
        fireEvent.click(receiptButtons[0]);

        expect(screen.getByRole('heading', { name: /gerar recibo/i })).toBeInTheDocument();
        expect(screen.getAllByText(/380,00/).length).toBeGreaterThan(0);
        expect(screen.getByDisplayValue(/fornecimento e aplica/i)).toBeInTheDocument();
    });

    it('preenche o recibo com os serviços de todos os orçamentos vinculados', () => {
        const pdfs = [
            {
                id: 10,
                clienteId: 1,
                date: appointmentDate,
                totalPreco: 200,
                totalM2: 2,
                nomeArquivo: 'residencial.pdf',
                proposalOptionName: 'Residencial',
                measurements: [{ pelicula: 'Carbono Prime', ambiente: 'Sala', tipoAplicacao: 'Janela' }],
            },
            {
                id: 11,
                clienteId: 1,
                date: appointmentDate,
                totalPreco: 180,
                totalM2: 1,
                nomeArquivo: 'comercial.pdf',
                proposalOptionName: 'Comercial',
                measurements: [{ pelicula: 'Jateada', ambiente: 'Entrada', tipoAplicacao: 'Porta' }],
            },
        ] as SavedPDF[];

        renderAgenda(
            [clientWithAddress],
            [{ ...appointment, pdfId: 10, pdfIds: [10, 11], serviceStatus: 'completed', valorFinal: 380 }],
            pdfs,
        );

        fireEvent.click(screen.getAllByRole('button', { name: /gerar recibo do servi/i })[0]);

        const description = screen.getByRole('textbox', { name: /descrição do serviço/i });
        const descriptionValue = (description as HTMLTextAreaElement).value;
        expect(descriptionValue).toContain('Carbono Prime');
        expect(descriptionValue).toContain('Jateada');
        expect(descriptionValue).toContain('Sala');
        expect(descriptionValue).toContain('Entrada');
    });

    it('pede confirmação da bobina antes de concluir um serviço com material', async () => {
        vi.setSystemTime(new Date('2026-05-24T15:00:00.000Z'));
        const onComplete = vi.fn().mockResolvedValue(true);
        const pdf = {
            id: 10,
            clienteId: 1,
            date: appointmentDate,
            totalPreco: 350,
            totalM2: 1,
            nomeArquivo: 'servico.pdf',
            measurements: [{
                id: 1,
                largura: '1',
                altura: '1',
                quantidade: 1,
                ambiente: 'Sala',
                tipoAplicacao: 'Janela',
                pelicula: 'Carbono Prime',
                active: true,
            }],
        } as SavedPDF;

        renderAgenda(
            [clientWithAddress],
            [{ ...appointment, pdfId: 10, pdfIds: [10] }],
            [pdf],
            onComplete,
        );

        fireEvent.click(screen.getAllByRole('button', { name: /^concluído$/i })[0]);
        fireEvent.change(screen.getAllByPlaceholderText('0,00')[0], { target: { value: '350,00' } });

        await act(async () => {
            fireEvent.click(screen.getAllByRole('button', { name: /confirmar conclusão/i })[0]);
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(screen.getByRole('combobox', { name: /bobina utilizada para carbono prime/i })).toHaveValue('8');
        expect(onComplete).not.toHaveBeenCalled();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /concluir e baixar estoque/i }));
            await Promise.resolve();
        });

        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({ id: 1 }),
            350,
            expect.objectContaining({
                stockStatus: 'confirmed',
                lines: [expect.objectContaining({ bobinaId: 8, filmId: 'Carbono Prime' })],
            }),
        );
    });
});
