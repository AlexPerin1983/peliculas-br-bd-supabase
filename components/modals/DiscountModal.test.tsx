import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DiscountModal from './DiscountModal';

vi.mock('../ui/Modal', () => ({
    default: ({ isOpen, title, children, footer }: {
        isOpen: boolean;
        title: ReactNode;
        children: ReactNode;
        footer?: ReactNode;
    }) => isOpen ? (
        <div role="dialog">
            <div>{title}</div>
            <div>{children}</div>
            <div>{footer}</div>
        </div>
    ) : null,
}));

describe('DiscountModal', () => {
    it('salva acrescimo e mostra o novo valor do grupo', () => {
        const onSave = vi.fn();
        render(
            <DiscountModal
                isOpen
                onClose={vi.fn()}
                onSave={onSave}
                basePrice={100}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Acréscimo' }));
        fireEvent.change(screen.getByLabelText('Valor do acréscimo'), { target: { value: '10' } });

        expect(screen.getByText(/110,00/)).toBeInTheDocument();
        expect(screen.getByText(/não aparecerá como uma linha de acréscimo/i)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Salvar ajuste' }));
        expect(onSave).toHaveBeenCalledWith({
            value: '10',
            type: 'percentage',
            operation: 'increase',
        });
    });
});
