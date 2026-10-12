import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ClientPostSaleSheet from './ClientPostSaleSheet';
import type { ComponentProps } from 'react';
import type { Client } from '../../types';
import { enqueueWhatsAppMessage, getWhatsAppConnectionStatus } from '../../services/supabaseDb';

vi.mock('../../services/supabaseDb', () => ({
    getWhatsAppConnectionStatus: vi.fn(),
    enqueueWhatsAppMessage: vi.fn(),
}));

const client: Client = {
    id: 1,
    nome: 'William Silva',
    telefone: '11999998888',
    email: '',
    cpfCnpj: '',
};

const renderSheet = (overrides: Partial<ComponentProps<typeof ClientPostSaleSheet>> = {}) => {
    const props = {
        isOpen: true,
        kind: 'review_request' as const,
        client,
        message: 'Oi, William! Pode avaliar nosso serviço?',
        agendamentoId: 9,
        onClose: vi.fn(),
        onSent: vi.fn(),
        ...overrides,
    };
    render(<ClientPostSaleSheet {...props} />);
    return props;
};

describe('pós-venda com WhatsApp conectado', () => {
    beforeEach(() => {
        vi.mocked(getWhatsAppConnectionStatus).mockReset();
        vi.mocked(enqueueWhatsAppMessage).mockReset();
    });

    it('sem conexão ligada, a tela fica como sempre: só o envio pelo WhatsApp do aparelho', async () => {
        vi.mocked(getWhatsAppConnectionStatus).mockResolvedValue({ enabled: false });
        renderSheet();

        await waitFor(() => expect(getWhatsAppConnectionStatus).toHaveBeenCalledTimes(1));
        expect(screen.getByRole('link', { name: /Enviar no WhatsApp/ })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /WhatsApp conectado/ })).not.toBeInTheDocument();
    });

    it('com a conexão ligada, põe a mensagem editada na fila e troca o rodapé por Fechar', async () => {
        vi.mocked(getWhatsAppConnectionStatus).mockResolvedValue({ enabled: true, channel: 'local_panel', lastSeenAt: new Date().toISOString() });
        vi.mocked(enqueueWhatsAppMessage).mockResolvedValue({ id: 42, duplicate: false });
        const props = renderSheet();

        const queueButton = await screen.findByRole('button', { name: 'Enviar pelo WhatsApp conectado' });
        fireEvent.change(screen.getByLabelText('Mensagem do pós-venda'), { target: { value: '  Oi, William! Mensagem ajustada.  ' } });
        fireEvent.click(queueButton);

        await screen.findByRole('button', { name: 'Na fila do WhatsApp conectado' });
        expect(enqueueWhatsAppMessage).toHaveBeenCalledWith(1, 'review_request', 'Oi, William! Mensagem ajustada.', 9);
        expect(screen.getByText(/aparece no histórico do cliente quando o painel enviar/)).toBeInTheDocument();
        // Sem o link manual, para não mandar duas vezes; o pedido só é registrado quando o painel enviar.
        expect(screen.queryByRole('link', { name: /Enviar no WhatsApp/ })).not.toBeInTheDocument();
        expect(props.onSent).not.toHaveBeenCalled();
        // O X da janela também se chama "Fechar"; este é o botão do rodapé.
        const footerClose = screen.getAllByRole('button', { name: 'Fechar' }).find(button => button.textContent === 'Fechar');
        fireEvent.click(footerClose!);
        expect(props.onClose).toHaveBeenCalled();
    });

    it('avisa quando o pedido já estava na fila', async () => {
        vi.mocked(getWhatsAppConnectionStatus).mockResolvedValue({ enabled: true, channel: 'local_panel', lastSeenAt: null });
        vi.mocked(enqueueWhatsAppMessage).mockResolvedValue({ id: 42, duplicate: true });
        renderSheet({ kind: 'referral_request' });

        fireEvent.click(await screen.findByRole('button', { name: 'Enviar pelo WhatsApp conectado' }));
        expect(await screen.findByText(/já estava na fila/)).toBeInTheDocument();
        expect(enqueueWhatsAppMessage).toHaveBeenCalledWith(1, 'referral_request', 'Oi, William! Pode avaliar nosso serviço?', 9);
    });

    it('se a fila recusar, mostra o motivo e mantém o envio pelo aparelho', async () => {
        vi.mocked(getWhatsAppConnectionStatus).mockResolvedValue({ enabled: true, channel: 'local_panel', lastSeenAt: null });
        vi.mocked(enqueueWhatsAppMessage).mockRejectedValue(new Error('Cadastre um telefone válido para este cliente'));
        renderSheet();

        fireEvent.click(await screen.findByRole('button', { name: 'Enviar pelo WhatsApp conectado' }));
        expect(await screen.findByText('Cadastre um telefone válido para este cliente')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Enviar no WhatsApp/ })).toBeInTheDocument();
    });

    it('avisa quando o painel do computador está fechado há algum tempo', async () => {
        vi.mocked(getWhatsAppConnectionStatus).mockResolvedValue({ enabled: true, channel: 'local_panel', lastSeenAt: new Date(Date.now() - 60 * 60_000).toISOString() });
        renderSheet();

        expect(await screen.findByText(/A mensagem sai quando ele for aberto/)).toBeInTheDocument();
    });
});
