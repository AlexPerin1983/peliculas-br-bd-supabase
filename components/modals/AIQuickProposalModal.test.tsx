import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AIQuickProposalModal from './AIQuickProposalModal';

vi.mock('../ui/Modal', () => ({
    default: ({
        title,
        children,
        footer,
        keyboardAwareFooter,
    }: {
        title: ReactNode;
        children: ReactNode;
        footer?: ReactNode;
        keyboardAwareFooter?: boolean;
    }) => (
        <section
            data-testid="modal-mock"
            data-keyboard-aware-footer={String(Boolean(keyboardAwareFooter))}
        >
            <h1>{title}</h1>
            <div>{children}</div>
            {footer && <footer>{footer}</footer>}
        </section>
    ),
}));

vi.mock('../../src/contexts/FeedbackContext', () => ({
    useFeedback: () => ({
        showAlert: vi.fn(),
        showToast: vi.fn(),
    }),
}));

const renderModal = (onProcess = vi.fn().mockResolvedValue(undefined)) => {
    render(
        <AIQuickProposalModal
            isOpen
            onClose={vi.fn()}
            onProcess={onProcess}
            isProcessing={false}
            provider="gemini"
        />
    );

    return { onProcess };
};

describe('AIQuickProposalModal', () => {
    it('ativa o footer sensível ao teclado no modal base', () => {
        renderModal();

        expect(screen.getByTestId('modal-mock')).toHaveAttribute(
            'data-keyboard-aware-footer',
            'true',
        );
    });

    it('envia o texto para criar a proposta com um único clique', async () => {
        const { onProcess } = renderModal();
        const description = 'Três janelas espelhadas com 1,80 por 1 metro';

        fireEvent.change(screen.getByRole('textbox'), {
            target: { value: description },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Criar proposta' }));

        await waitFor(() => {
            expect(onProcess).toHaveBeenCalledTimes(1);
        });
        expect(onProcess).toHaveBeenCalledWith(expect.objectContaining({
            text: description,
        }));
    });
});
