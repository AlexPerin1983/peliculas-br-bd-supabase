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

        fireEvent.click(screen.getByRole('button', { name: /adicionar cpf, endereço e email/i }));

        expect(screen.getByLabelText(/cpf\/cnpj/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/^cep/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/^email/i)).toBeInTheDocument();
    });
});
