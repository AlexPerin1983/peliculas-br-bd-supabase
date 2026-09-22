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
    it('mantém acréscimo e desconto em campos separados e aplica ambos ao valor final', () => {
        const onSave = vi.fn();
        render(
            <DiscountModal
                isOpen
                onClose={vi.fn()}
                onSave={onSave}
                basePrice={100}
            />
        );

        fireEvent.change(screen.getByRole('textbox', { name: 'Acréscimo' }), { target: { value: '10' } });

        expect(screen.getByText(/110,00/)).toBeInTheDocument();
        fireEvent.change(screen.getByRole('textbox', { name: 'Desconto' }), { target: { value: '20' } });
        expect(screen.getByText(/88,00/)).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Acréscimo' })).toHaveValue('10');

        fireEvent.click(screen.getByRole('button', { name: 'Salvar ajuste' }));
        expect(onSave).toHaveBeenCalledWith({
            value: '20',
            type: 'percentage',
            operation: 'discount',
            increaseValue: '10',
            increaseType: 'percentage',
            discountValue: '20',
            discountType: 'percentage',
        });
    });

    it('abre ajuste antigo de acréscimo sem transformá-lo em desconto', () => {
        render(<DiscountModal isOpen onClose={vi.fn()} onSave={vi.fn()} basePrice={100} initialAdjustment={{ value: '10', type: 'fixed', operation: 'increase' }} />);
        expect(screen.getByRole('textbox', { name: 'Acréscimo' })).toHaveValue('10');
        expect(screen.getByRole('textbox', { name: 'Desconto' })).toHaveValue('');
        expect(screen.getByText(/110,00/)).toBeInTheDocument();
    });
});
