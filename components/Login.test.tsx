import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Login } from './Login';

const authMocks = vi.hoisted(() => ({
    signUp: vi.fn(),
    signOut: vi.fn(),
    signInWithPassword: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    signInWithOAuth: vi.fn(),
    invoke: vi.fn()
}));

vi.mock('../services/supabaseClient', () => ({
    supabase: {
        auth: {
            signUp: authMocks.signUp,
            signOut: authMocks.signOut,
            signInWithPassword: authMocks.signInWithPassword,
            resetPasswordForEmail: authMocks.resetPasswordForEmail,
            signInWithOAuth: authMocks.signInWithOAuth
        },
        functions: {
            invoke: authMocks.invoke
        }
    }
}));

describe('Login - sequência de novo cadastro', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
        authMocks.invoke.mockResolvedValue({ data: null, error: null });
        authMocks.signOut.mockResolvedValue({ error: null });
    });

    it('volta ao login após criar a conta, sem avançar direto para a empresa', async () => {
        authMocks.signUp.mockResolvedValue({
            data: {
                user: { id: 'user-1' },
                session: { access_token: 'token-de-teste' }
            },
            error: null
        });

        render(<Login />);

        fireEvent.click(screen.getByRole('button', { name: 'Não tem conta? Crie uma conta' }));
        fireEvent.change(screen.getByPlaceholderText('Joao Silva'), {
            target: { value: 'Cliente Teste' }
        });
        fireEvent.change(screen.getByPlaceholderText('peliculasbr@gmail.com'), {
            target: { value: 'cliente@teste.com' }
        });

        const passwordInputs = document.querySelectorAll<HTMLInputElement>('input[type="password"]');
        expect(passwordInputs).toHaveLength(2);
        fireEvent.change(passwordInputs[0], { target: { value: 'senha123' } });
        fireEvent.change(passwordInputs[1], { target: { value: 'senha123' } });
        fireEvent.click(screen.getByRole('button', { name: 'Cadastrar', exact: true }));

        expect(await screen.findByText('Cadastro realizado! Agora faça login para continuar.')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Fazer Login' })).toBeInTheDocument();
        expect(screen.getByPlaceholderText('peliculasbr@gmail.com')).toHaveValue('cliente@teste.com');

        await waitFor(() => {
            expect(authMocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
        });
        expect(sessionStorage.getItem('peliculas-br-signup-pending-login')).toBeNull();
    });
});
