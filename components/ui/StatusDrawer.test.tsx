import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StatusDrawer } from './StatusDrawer';
import type { Retalho } from '../../types';

const retalho: Retalho = { id: 72, filmId: 'Blackout', codigoQr: 'r72', larguraCm: 91, comprimentoCm: 27, status: 'disponivel' };
const options = [
    { value: 'disponivel', label: 'Disponível', emoji: 'D', color: '#22c55e' },
    { value: 'reservado', label: 'Reservado', emoji: 'R', color: '#f59e0b' },
    { value: 'usado', label: 'Usado', emoji: 'U', color: '#f97316' },
    { value: 'descartado', label: 'Descartado', emoji: 'X', color: '#ef4444' },
];

const setup = (onStatusChange: (status: string) => Promise<void> | void = vi.fn()) => {
    const onClose = vi.fn();
    const onDelete = vi.fn();
    render(
        <StatusDrawer
            isOpen
            onClose={onClose}
            type="retalho"
            item={retalho}
            currentStatus="disponivel"
            statusOptions={options}
            onStatusChange={onStatusChange}
            onDelete={onDelete}
            getStatusLabel={status => status}
            getStatusColor={() => '#22c55e'}
        />
    );
    return { onClose, onDelete, sheet: screen.getByRole('dialog') };
};

describe('StatusDrawer', () => {
    it('mostra o item, o que cada status significa e qual é o atual', () => {
        const { sheet } = setup();
        expect(sheet).toHaveTextContent('Alterar status');
        expect(sheet).toHaveTextContent('Blackout · Retalho #72 · 0,91 × 0,27 m');
        const current = within(sheet).getByRole('radio', { name: /Disponível/ });
        expect(current).toHaveAttribute('aria-checked', 'true');
        expect(current).toHaveTextContent('Livre para usar em um serviço');
        expect(current).toHaveTextContent('Atual');
        expect(within(sheet).getByRole('radio', { name: /Usado/ })).toHaveTextContent('Já foi aplicado e sai do estoque livre');
    });

    it('salva o novo status mostrando o carregamento; quem chama fecha a folha', async () => {
        let finish: () => void = () => undefined;
        const onStatusChange = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
        const { onClose, sheet } = setup(onStatusChange);

        fireEvent.click(within(sheet).getByRole('radio', { name: /Usado/ }));
        expect(onStatusChange).toHaveBeenCalledWith('usado');
        expect(within(sheet).getByLabelText('Salvando')).toBeInTheDocument();
        // Enquanto salva, as outras opções ficam travadas.
        expect(within(sheet).getByRole('radio', { name: /Reservado/ })).toBeDisabled();

        await act(async () => finish());
        expect(within(sheet).queryByLabelText('Salvando')).not.toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('excluir fica discreto e passa pela confirmação de quem chama', () => {
        const { onClose, onDelete, sheet } = setup();
        fireEvent.click(within(sheet).getByRole('button', { name: /Excluir retalho/ }));
        expect(onDelete).toHaveBeenCalledWith('retalho', 72);
        expect(onClose).toHaveBeenCalled();
    });
});
