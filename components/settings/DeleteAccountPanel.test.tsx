import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DeleteAccountPanel from './DeleteAccountPanel';

const mocks = vi.hoisted(() => ({
    invoke: vi.fn(),
    signOut: vi.fn(),
    clearAllLocalData: vi.fn(),
    isOwner: true,
}));

vi.mock('../../services/supabaseClient', () => ({
    supabase: {
        auth: { signOut: mocks.signOut },
        functions: { invoke: mocks.invoke },
    },
}));

vi.mock('../../services/offlineDb', () => ({
    clearAllLocalData: mocks.clearAllLocalData,
}));

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ isOwner: mocks.isOwner }),
}));

const openConfirmation = () => {
    fireEvent.click(screen.getByRole('button', { name: /Excluir minha conta/ }));
    return screen.getByRole('button', { name: /Excluir conta definitivamente/ });
};

describe('DeleteAccountPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.isOwner = true;
        mocks.signOut.mockResolvedValue({ error: null });
        mocks.clearAllLocalData.mockResolvedValue(undefined);
    });

    it('só libera a exclusão depois de digitar EXCLUIR', () => {
        render(<DeleteAccountPanel />);
        const confirm = openConfirmation();
        expect(confirm).toBeDisabled();

        fireEvent.change(screen.getByLabelText(/Digite EXCLUIR/), { target: { value: 'excluir' } });
        expect(confirm).toBeEnabled();
    });

    it('avisa o dono que a empresa inteira será apagada', () => {
        render(<DeleteAccountPanel />);
        openConfirmation();
        expect(screen.getByText(/todos os dados da empresa/)).toBeInTheDocument();
    });

    it('avisa o membro que os dados da empresa continuam', () => {
        mocks.isOwner = false;
        render(<DeleteAccountPanel />);
        openConfirmation();
        expect(screen.getByText(/continuam com o dono/)).toBeInTheDocument();
    });

    it('chama o servidor, limpa a cópia local e sai', async () => {
        const replace = vi.fn();
        const originalLocation = window.location;
        Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, replace } });
        mocks.invoke.mockResolvedValue({ data: { success: true }, error: null });

        render(<DeleteAccountPanel />);
        const confirm = openConfirmation();
        fireEvent.change(screen.getByLabelText(/Digite EXCLUIR/), { target: { value: 'EXCLUIR' } });
        fireEvent.click(confirm);

        await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
        expect(mocks.invoke).toHaveBeenCalledWith('delete-account', { body: { confirmation: 'EXCLUIR' } });
        expect(mocks.clearAllLocalData).toHaveBeenCalled();
        expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });

        Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    });

    it('mostra o erro e não sai quando o servidor recusa', async () => {
        mocks.invoke.mockResolvedValue({ data: { success: false, error: 'Falha ao apagar o login' }, error: null });

        render(<DeleteAccountPanel />);
        const confirm = openConfirmation();
        fireEvent.change(screen.getByLabelText(/Digite EXCLUIR/), { target: { value: 'EXCLUIR' } });
        fireEvent.click(confirm);

        expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao apagar o login');
        expect(mocks.clearAllLocalData).not.toHaveBeenCalled();
        expect(mocks.signOut).not.toHaveBeenCalled();
    });
});
