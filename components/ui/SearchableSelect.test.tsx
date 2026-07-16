import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SearchableSelect from './SearchableSelect';

const clients = [
    { id: 1, nome: 'Bruno', telefone: '83999990000' },
    { id: 2, nome: 'Bruno Lima', telefone: '83888880000' },
];

describe('SearchableSelect', () => {
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
});
