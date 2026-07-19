import { fireEvent, render, screen } from '@testing-library/react';
import EstoqueMobileHeader from './EstoqueMobileHeader';
import EstoqueMobileAddSheet from './EstoqueMobileAddSheet';
import EstoqueBobinasPanel from './EstoqueBobinasPanel';
import EstoqueRetalhosPanel from './EstoqueRetalhosPanel';

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

    it('agrupa retalhos por película e destaca o melhor encaixe por medida', () => {
        const onOpenDetails = vi.fn();
        const retalhos = [
            { id: 68, filmId: 'Jateada', codigoQr: 'retalho-68', larguraCm: 100, comprimentoCm: 110, areaM2: 1.1, status: 'disponivel' as const, localizacao: 'Carro' },
            { id: 63, filmId: 'Jateada', codigoQr: 'retalho-63', larguraCm: 105, comprimentoCm: 210, areaM2: 2.205, status: 'disponivel' as const },
            { id: 70, filmId: 'Carbono', codigoQr: 'retalho-70', larguraCm: 120, comprimentoCm: 120, areaM2: 1.44, status: 'disponivel' as const, localizacao: 'Estante' },
        ];

        render(
            <EstoqueRetalhosPanel
                viewMode="list"
                filteredRetalhos={retalhos}
                searchDimensions={{ larguraCm: 100, comprimentoCm: 100 }}
                onShowQR={vi.fn()}
                onChangeStatus={vi.fn()}
                onDelete={vi.fn()}
                onOpenDetails={onOpenDetails}
                getStatusLabel={() => 'Disponível'}
                getStatusColor={() => '#22c55e'}
            />
        );

        expect(screen.getByText('2 retalhos')).toBeInTheDocument();
        expect(screen.getByText('Melhor encaixe')).toBeInTheDocument();
        expect(screen.getByText('Sem localização')).toBeInTheDocument();
        expect(screen.getAllByText('1,00 × 1,10 m').length).toBeGreaterThan(0);

        const mobileRow = screen.getAllByRole('button').find(button => button.textContent?.includes('#68'));
        fireEvent.click(mobileRow!);
        expect(onOpenDetails).toHaveBeenCalledWith({ type: 'retalho', item: retalhos[0] });
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
