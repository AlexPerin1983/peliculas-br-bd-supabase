import { fireEvent, render, screen } from '@testing-library/react';
import EstoqueMobileHeader from './EstoqueMobileHeader';
import EstoqueMobileAddSheet from './EstoqueMobileAddSheet';
import EstoqueBobinasPanel from './EstoqueBobinasPanel';

describe('redesenho mobile do estoque', () => {
    it('alterna entre itens e resumo e mantém busca e filtro acessíveis', () => {
        const onChangeMode = vi.fn();
        const onSearchChange = vi.fn();
        const onOpenFilter = vi.fn();

        render(
            <EstoqueMobileHeader
                activeTab="bobinas"
                mode="items"
                bobinasCount={3}
                retalhosCount={11}
                searchTerm=""
                filterActive
                onChangeTab={vi.fn()}
                onChangeMode={onChangeMode}
                onSearchChange={onSearchChange}
                onOpenFilter={onOpenFilter}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Resumo' }));
        expect(onChangeMode).toHaveBeenCalledWith('summary');

        fireEvent.change(screen.getByPlaceholderText('Buscar bobina...'), { target: { value: 'prime' } });
        expect(onSearchChange).toHaveBeenCalledWith('prime');

        fireEvent.click(screen.getByRole('button', { name: 'Alterar filtro ativo' }));
        expect(onOpenFilter).toHaveBeenCalledTimes(1);
    });

    it('abre os detalhes ao tocar na linha sem expor exclusão na listagem', () => {
        const onOpenDetails = vi.fn();
        const bobina = {
            id: 37,
            filmId: 'Color Stable',
            codigoQr: 'bobina-37',
            larguraCm: 152,
            comprimentoTotalM: 20,
            comprimentoRestanteM: 17,
            fornecedor: '3M',
            lote: '1230',
            status: 'ativa' as const,
        };

        render(
            <EstoqueBobinasPanel
                viewMode="list"
                filteredBobinas={[bobina]}
                onShowQR={vi.fn()}
                onChangeStatus={vi.fn()}
                onDelete={vi.fn()}
                onOpenDetails={onOpenDetails}
                getStatusLabel={() => 'Ativa'}
                getStatusColor={() => '#22c55e'}
            />
        );

        const mobileRow = screen.getAllByRole('button').find(button => button.textContent?.includes('Color Stable'));
        expect(mobileRow).toBeDefined();
        fireEvent.click(mobileRow!);
        expect(onOpenDetails).toHaveBeenCalledWith({ type: 'bobina', item: bobina });
    });

    it('oferece as quatro entradas do cadastro em uma única folha', () => {
        const onAddBobina = vi.fn();
        const onOpenChange = vi.fn();

        render(
            <EstoqueMobileAddSheet
                open
                onOpenChange={onOpenChange}
                onAddBobina={onAddBobina}
                onAddRetalho={vi.fn()}
                onAddWithAI={vi.fn()}
                onScan={vi.fn()}
            />
        );

        expect(screen.getByRole('button', { name: /Nova bobina/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Novo retalho/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Cadastrar com IA/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Escanear QR/i })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Nova bobina/i }));
        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(onAddBobina).toHaveBeenCalledTimes(1);
    });
});
