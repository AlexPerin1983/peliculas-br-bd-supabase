import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ClientModal from './ClientModal';

const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
    mode: 'add' as const,
    client: null,
    onOpenAIModal: vi.fn(),
};

describe('ClientModal', () => {
    it('prioriza os campos essenciais no cadastro novo', () => {
        render(<ClientModal {...defaultProps} />);

        expect(screen.getByLabelText(/nome do cliente/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/telefone/i)).toBeInTheDocument();
        expect(screen.queryByLabelText(/cpf\/cnpj/i)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/^cep/i)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/^email/i)).not.toBeInTheDocument();
    });

    it('permite revelar todos os campos opcionais sem perder o fluxo atual', () => {
        render(<ClientModal {...defaultProps} />);

        fireEvent.click(screen.getByRole('button', { name: /adicionar cpf\/cnpj, responsável, endereço e mais/i }));

        expect(screen.getByLabelText(/cpf\/cnpj/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/^cep/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/^email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/^responsável/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/^cargo/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/outras informações/i)).toBeInTheDocument();
    });

    it('salva responsável, cargo e outras informações do cliente', async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        const client = {
            id: 7, nome: 'SENAT', telefone: '', email: '', cpfCnpj: '',
            responsavel: 'Adenilza', cargo: 'Assistente Administrativa', infoAdicional: 'Unidade: B 028',
        };
        render(<ClientModal {...defaultProps} mode="edit" client={client} onSave={onSave} />);

        expect(screen.getByLabelText(/^responsável/i)).toHaveValue('Adenilza');
        fireEvent.change(screen.getByLabelText(/outras informações/i), { target: { value: 'Unidade: B 028\nProcesso: 000020289-7/2026' } });
        fireEvent.click(screen.getByRole('button', { name: /salvar cliente/i }));

        await vi.waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
            responsavel: 'Adenilza',
            cargo: 'Assistente Administrativa',
            infoAdicional: 'Unidade: B 028\nProcesso: 000020289-7/2026',
        })));
    });
});
