import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommunityAccessGate } from './CommunityAccessGate';

const rpcMock = vi.hoisted(() => vi.fn());

vi.mock('../services/supabaseClient', () => ({
    supabase: {
        rpc: rpcMock
    }
}));

describe('CommunityAccessGate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('abre o grupo antes de mostrar a validacao por codigo', () => {
        render(<CommunityAccessGate onGranted={vi.fn()} onSignOut={vi.fn()} />);

        expect(screen.getByText(/Aplicativo 100% gratuito/i)).toBeInTheDocument();
        expect(screen.getByText(/Sem cobrança, assinatura ou cadastro de cartão/i)).toBeInTheDocument();
        expect(screen.getByText(/link para abrir e instalar o aplicativo/i)).toBeInTheDocument();
        expect(screen.queryByLabelText('Codigo do grupo')).not.toBeInTheDocument();

        const groupLink = screen.getByRole('link', { name: /Receber meu acesso gratuito/i });
        expect(groupLink).toHaveAttribute('href', 'https://chat.whatsapp.com/L7lDpi6vxD0BYLO3vaE0fW');

        fireEvent.click(groupLink);
        expect(screen.getByLabelText('Codigo do grupo')).toBeInTheDocument();
    });

    it('libera a conta quando o servidor aceita o codigo', async () => {
        const onGranted = vi.fn().mockResolvedValue(undefined);
        rpcMock.mockResolvedValue({ data: { success: true }, error: null });
        render(<CommunityAccessGate onGranted={onGranted} onSignOut={vi.fn()} />);

        fireEvent.click(screen.getByRole('link', { name: /Receber meu acesso gratuito/i }));
        fireEvent.change(screen.getByLabelText('Codigo do grupo'), { target: { value: 'aplicador25' } });
        fireEvent.click(screen.getByRole('button', { name: 'Liberar meu acesso' }));

        await waitFor(() => {
            expect(rpcMock).toHaveBeenCalledWith('redeem_community_access', { p_code: 'APLICADOR25' });
            expect(onGranted).toHaveBeenCalledTimes(1);
        });
    });

    it('mantem o bloqueio quando o codigo esta incorreto', async () => {
        rpcMock.mockResolvedValue({ data: { success: false, reason: 'invalid_code' }, error: null });
        render(<CommunityAccessGate onGranted={vi.fn()} onSignOut={vi.fn()} />);

        fireEvent.click(screen.getByRole('link', { name: /Receber meu acesso gratuito/i }));
        fireEvent.change(screen.getByLabelText('Codigo do grupo'), { target: { value: 'ERRADO' } });
        fireEvent.click(screen.getByRole('button', { name: 'Liberar meu acesso' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('Codigo incorreto');
    });
});
