import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SearchableSelect from './SearchableSelect';

const mobileState = vi.hoisted(() => ({ value: false }));

vi.mock('../../src/hooks/useIsMobile', () => ({
    useIsMobile: () => mobileState.value,
}));

const clients = [
    { id: 1, nome: 'Bruno', telefone: '83999990000' },
    { id: 2, nome: 'Bruno Lima', telefone: '83888880000' },
];

describe('SearchableSelect', () => {
    beforeEach(() => {
        mobileState.value = false;
    });

    it('mantém a ação de cadastro disponível mesmo quando a busca encontra resultados', async () => {
        const onAdd = vi.fn();

        render(
            <SearchableSelect
                options={clients}
                value={null}
                onChange={vi.fn()}
                displayField="nome"
                valueField="id"
                placeholder="Selecione ou digite um nome"
                renderSearchAction={(searchTerm) => (
                    <li>
                        <button type="button" onClick={() => onAdd(searchTerm)}>
                            Cadastrar novo “{searchTerm}”
                        </button>
                    </li>
                )}
            />
        );

        const input = screen.getByPlaceholderText('Selecione ou digite um nome');
        fireEvent.click(input);
        fireEvent.change(input, { target: { value: 'Bruno' } });

        const addButton = await screen.findByRole('button', { name: 'Cadastrar novo “Bruno”' });
        expect(screen.getByText('Bruno Lima')).toBeInTheDocument();

        fireEvent.click(addButton);
        await waitFor(() => expect(onAdd).toHaveBeenCalledWith('Bruno'));
    });

    it('mantem a busca e o fechamento abaixo da area nativa do iPhone', () => {
        mobileState.value = true;

        render(
            <SearchableSelect
                options={clients}
                value={null}
                onChange={vi.fn()}
                displayField="nome"
                valueField="id"
                placeholder="Selecione ou digite um nome"
                listHeader="Favoritos e recentes"
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Selecione ou digite um nome' }));

        const dialog = screen.getByRole('dialog', { name: 'Selecione ou digite um nome' });
        const header = dialog.querySelector<HTMLElement>('[data-mobile-search-header]');
        expect(header?.getAttribute('style')).toContain('safe-area-inset-top');
        expect(header?.getAttribute('style')).toContain('0.75rem');

        const closeButton = screen.getByRole('button', { name: 'Fechar' });
        expect(closeButton).toHaveClass('h-11', 'w-11', 'touch-manipulation');
    });
});
