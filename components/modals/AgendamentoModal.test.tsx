import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AgendamentoModal from './AgendamentoModal';

vi.mock('../../services/db', () => ({
    getActiveTeamSize: vi.fn().mockResolvedValue(1),
}));

describe('AgendamentoModal', () => {
    it('abre a criacao manual sem depender dos recursos de IA', () => {
        render(
            <AgendamentoModal
                isOpen
                onClose={vi.fn()}
                onSave={vi.fn().mockResolvedValue(undefined)}
                onDelete={vi.fn()}
                schedulingInfo={{ agendamento: {} }}
                clients={[]}
                savedPdfs={[]}
                onAddNewClient={vi.fn()}
                userInfo={null}
                agendamentos={[]}
            />
        );

        expect(screen.getByText('Novo Agendamento')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Agendar' })).toBeInTheDocument();
        expect(screen.queryByText(/sugerir com ia/i)).not.toBeInTheDocument();
    });
});
