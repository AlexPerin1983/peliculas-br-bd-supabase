import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AIScheduleModal from './AIScheduleModal';

vi.mock('../ui/Modal', () => ({
    default: ({ title, children, footer }: { title: ReactNode; children: ReactNode; footer?: ReactNode }) => (
        <section>
            <h1>{title}</h1>
            <div>{children}</div>
            {footer && <footer>{footer}</footer>}
        </section>
    ),
}));

vi.mock('../../src/contexts/FeedbackContext', () => ({
    useFeedback: () => ({ showAlert: vi.fn(), showToast: vi.fn() }),
}));

const renderModal = (autoSave: boolean, onToggleAutoSave = vi.fn()) => {
    render(
        <AIScheduleModal
            isOpen
            onClose={vi.fn()}
            onProcess={vi.fn().mockResolvedValue(undefined)}
            isProcessing={false}
            provider="gemini"
            autoSave={autoSave}
            onToggleAutoSave={onToggleAutoSave}
        />
    );
    return { onToggleAutoSave };
};

describe('AIScheduleModal', () => {
    it('mostra a chave "Salvar direto na agenda" desligada, com conferência', () => {
        const { onToggleAutoSave } = renderModal(false);

        const toggle = screen.getByRole('switch', { name: /Salvar direto na agenda/ });
        expect(toggle).toHaveAttribute('aria-checked', 'false');
        expect(screen.getByText(/você confere antes de salvar/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Preencher agendamento' })).toBeInTheDocument();

        fireEvent.click(toggle);
        expect(onToggleAutoSave).toHaveBeenCalledWith(true);
    });

    it('com a chave ligada, avisa que parar o áudio já salva', () => {
        renderModal(true);

        expect(screen.getByRole('switch', { name: /Salvar direto na agenda/ })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByText(/Ao parar, a IA já salva na agenda/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Salvar na agenda' })).toBeInTheDocument();
    });
});
