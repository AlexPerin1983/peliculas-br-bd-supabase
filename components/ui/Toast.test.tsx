import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Toast from './Toast';

describe('Toast', () => {
    it('com duas ações, mostra "Desfazer" e "Ver" e chama cada uma', () => {
        const onAction = vi.fn();
        const onSecondaryAction = vi.fn();
        render(
            <Toast
                message="Agendado: sex., 02/10, 10:00–11:00 · Maria"
                tone="success"
                actionLabel="Ver"
                onAction={onAction}
                secondaryActionLabel="Desfazer"
                onSecondaryAction={onSecondaryAction}
                onDismiss={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
        expect(onSecondaryAction).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole('button', { name: 'Ver' }));
        expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('com uma ação só, continua igual', () => {
        render(<Toast message="Salvo" actionLabel="Ver" onAction={vi.fn()} onDismiss={vi.fn()} />);

        expect(screen.getByRole('button', { name: 'Ver' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Desfazer' })).not.toBeInTheDocument();
    });
});
