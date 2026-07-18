import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizationSetup } from './OrganizationSetup';
import { bootstrapOrganization } from '../services/organizationSetupService';

vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({ signOut: vi.fn() })
}));

vi.mock('../services/organizationSetupService', () => ({
    bootstrapOrganization: vi.fn()
}));

vi.mock('../services/imageProcessing', () => ({
    processLogoImage: vi.fn()
}));

describe('OrganizationSetup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('destaca e foca o telefone ao tentar continuar sem um número válido', () => {
        render(
            <OrganizationSetup
                initialEmail="contato@empresa.com"
                initialOwnerName="Alex"
                onCompleted={vi.fn()}
            />
        );

        const phoneInput = screen.getByLabelText(/Telefone/);
        const submitButton = screen.getByRole('button', { name: 'Criar empresa e continuar' });

        expect(submitButton).toBeEnabled();
        fireEvent.click(submitButton);
        expect(phoneInput).toHaveFocus();
        expect(phoneInput).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByRole('alert')).toHaveTextContent('Informe seu telefone para continuar.');

        fireEvent.change(phoneInput, { target: { value: '8399647' } });
        expect(phoneInput).toHaveValue('(83) 9964-7');

        fireEvent.click(submitButton);
        expect(screen.getByRole('alert')).toHaveTextContent('Informe um telefone válido com DDD.');

        fireEvent.change(phoneInput, { target: { value: '83996476052' } });
        expect(phoneInput).toHaveValue('(83) 99647-6052');
        expect(submitButton).toBeEnabled();
    });

    it('envia o telefone formatado ao concluir o cadastro', async () => {
        vi.mocked(bootstrapOrganization).mockResolvedValue({
            success: true,
            organizationId: 'org-1',
            organizationName: 'Empresa do Alex'
        });
        const onCompleted = vi.fn();

        render(
            <OrganizationSetup
                initialEmail="contato@empresa.com"
                initialOwnerName="Alex"
                onCompleted={onCompleted}
            />
        );

        fireEvent.change(screen.getByLabelText(/Telefone/), {
            target: { value: '83996476052' }
        });
        fireEvent.change(screen.getByLabelText('Nome da empresa'), {
            target: { value: 'Películas do Alex' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Criar empresa e continuar' }));

        await waitFor(() => {
            expect(bootstrapOrganization).toHaveBeenCalledWith({
                companyName: 'Películas do Alex',
                ownerName: 'Alex',
                phone: '(83) 99647-6052'
            });
        });
        expect(onCompleted).toHaveBeenCalledWith('Empresa do Alex', undefined);
    });
});
