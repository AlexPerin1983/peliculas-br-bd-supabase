import { fireEvent, render, screen, within } from '@testing-library/react';
import EstoqueMobileHeader from './EstoqueMobileHeader';
import EstoqueMobileAddSheet from './EstoqueMobileAddSheet';
import EstoqueMobileFooter from './EstoqueMobileFooter';
import EstoqueBobinasPanel from './EstoqueBobinasPanel';
import EstoqueRetalhosPanel from './EstoqueRetalhosPanel';
import EstoqueItemSheet from './EstoqueItemSheet';
import type { Bobina, Retalho } from '../../../types';

const bobina = (overrides: Partial<Bobina> = {}): Bobina => ({
    id: 37,
    filmId: 'Color Stable',
    codigoQr: 'bobina-37',
    larguraCm: 152,
    comprimentoTotalM: 20,
    comprimentoRestanteM: 14.05,
    fornecedor: '3M',
    lote: '1230',
    status: 'ativa',
    ...overrides,
});

const retalho = (overrides: Partial<Retalho> = {}): Retalho => ({
    id: 68,
    filmId: 'Jateada',
    codigoQr: 'retalho-68',
    larguraCm: 100,
    comprimentoCm: 110,
    areaM2: 1.1,
    status: 'disponivel',
    localizacao: 'Carro',
    ...overrides,
});

describe('redesenho mobile do estoque', () => {
    it('topo: resumo em números, abas, busca e filtros rápidos com a quantidade', () => {
        const onChangeTab = vi.fn();
        const onSearchChange = vi.fn();
        const onStatusFilterChange = vi.fn();

        render(
            <EstoqueMobileHeader
                activeTab="bobinas"
                bobinas={[bobina(), bobina({ id: 38, filmId: 'Blackout', comprimentoRestanteM: 3.15, comprimentoTotalM: 20 }), bobina({ id: 12, status: 'finalizada', comprimentoRestanteM: 0 })]}
                retalhos={[retalho()]}
                stats={{ totalBobinasAtivas: 2, totalMetrosDisponiveis: 17.2, totalRetalhoDisponivel: 1, totalAreaRetalhos: 1.1, consumoUltimos30Dias: 5.95 }}
                searchTerm=""
                statusFilter="todos"
                onChangeTab={onChangeTab}
                onSearchChange={onSearchChange}
                onStatusFilterChange={onStatusFilterChange}
            />
        );

        expect(screen.getByRole('heading', { name: 'Estoque' })).toBeInTheDocument();
        expect(screen.getByText('3 bobinas · 1 retalho')).toBeInTheDocument();
        const summary = screen.getByRole('region', { name: 'Resumo do estoque' });
        expect(summary).toHaveTextContent('Metros livres17,20 m2 bobinas ativas');
        expect(summary).toHaveTextContent('Consumo 30 dias5,95 m');

        // Filtros com quantidade; os vazios (descartadas) não aparecem.
        const filters = screen.getByRole('group', { name: 'Filtrar estoque' });
        expect(within(filters).getAllByRole('button').map(button => button.textContent)).toEqual(['Todas 3', 'Ativas 2', 'Acabando 1', 'Finalizadas 1']);
        fireEvent.click(within(filters).getByRole('button', { name: /Acabando/ }));
        expect(onStatusFilterChange).toHaveBeenCalledWith('acabando');

        fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar no estoque' }), { target: { value: 'prime' } });
        expect(onSearchChange).toHaveBeenCalledWith('prime');

        fireEvent.click(screen.getByRole('tab', { name: /Retalhos/ }));
        expect(onChangeTab).toHaveBeenCalledWith('retalhos');
    });

    it('menu fixo: abas, cadastrar no botão central, escanear e buscar', () => {
        const onChangeTab = vi.fn();
        const onAdd = vi.fn();
        const onScan = vi.fn();
        const onSearch = vi.fn();
        render(<EstoqueMobileFooter activeTab="bobinas" lowStockCount={2} onChangeTab={onChangeTab} onAdd={onAdd} onScan={onScan} onSearch={onSearch} />);

        const menu = screen.getByRole('navigation', { name: 'Menu do estoque' });
        expect(within(menu).getByRole('button', { name: 'Bobinas' })).toHaveAttribute('aria-pressed', 'true');
        // Quantas bobinas estão acabando.
        expect(within(menu).getByRole('button', { name: 'Bobinas' })).toHaveTextContent('2');
        fireEvent.click(within(menu).getByRole('button', { name: 'Retalhos' }));
        expect(onChangeTab).toHaveBeenCalledWith('retalhos');
        fireEvent.click(within(menu).getByRole('button', { name: 'Cadastrar material' }));
        fireEvent.click(within(menu).getByRole('button', { name: 'Escanear' }));
        fireEvent.click(within(menu).getByRole('button', { name: 'Buscar' }));
        expect([onAdd, onScan, onSearch].map(fn => fn.mock.calls.length)).toEqual([1, 1, 1]);
    });

    it('bobina: cartão com o que resta, aviso de acabando e detalhes ao tocar', () => {
        const onOpenDetails = vi.fn();
        const low = bobina({ id: 38, filmId: 'Blackout', comprimentoRestanteM: 3.15, comprimentoTotalM: 20 });

        render(
            <EstoqueBobinasPanel
                viewMode="list"
                filteredBobinas={[bobina(), low]}
                onShowQR={vi.fn()}
                onChangeStatus={vi.fn()}
                onDelete={vi.fn()}
                onOpenDetails={onOpenDetails}
                getStatusLabel={() => 'Ativa'}
                getStatusColor={() => '#22c55e'}
            />
        );

        const list = screen.getByRole('list', { name: 'Bobinas' });
        const [first, second] = within(list).getAllByRole('button');
        expect(first).toHaveTextContent('Color Stable');
        expect(first).toHaveTextContent('70%');
        expect(within(first).getByText('14,05 m')).toBeInTheDocument();
        expect(within(first).getByText('de 20,00 m')).toBeInTheDocument();
        expect(first).not.toHaveTextContent('Acabando');
        expect(second).toHaveTextContent('Acabando');
        fireEvent.click(first);
        expect(onOpenDetails).toHaveBeenCalledWith({ type: 'bobina', item: bobina() });
    });

    it('agrupa retalhos por película e destaca o melhor encaixe por medida', () => {
        const onOpenDetails = vi.fn();
        const retalhos = [
            retalho(),
            retalho({ id: 63, codigoQr: 'retalho-63', larguraCm: 105, comprimentoCm: 210, areaM2: 2.205, localizacao: undefined }),
            retalho({ id: 70, filmId: 'Carbono', codigoQr: 'retalho-70', larguraCm: 120, comprimentoCm: 120, areaM2: 1.44, localizacao: 'Estante' }),
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

    it('ficha do material: números, dados e ações', () => {
        const onClose = vi.fn();
        const onShowQR = vi.fn();
        const selected = { type: 'bobina' as const, item: bobina({ localizacao: 'Prateleira A' }) };

        render(
            <EstoqueItemSheet
                selected={selected}
                onClose={onClose}
                onShowQR={onShowQR}
                onChangeStatus={vi.fn()}
                onDelete={vi.fn()}
                getStatusLabel={() => 'Ativa'}
                getStatusColor={() => '#22c55e'}
            />
        );

        const sheet = screen.getByRole('dialog');
        expect(sheet).toHaveTextContent('Color Stable');
        expect(sheet).toHaveTextContent('Bobina #37');
        expect(sheet).toHaveTextContent('Restante14,05 m');
        expect(sheet).toHaveTextContent('Lote1230');
        expect(sheet).toHaveTextContent('Fornecedor3M');
        expect(sheet).toHaveTextContent('LocalPrateleira A');

        fireEvent.click(within(sheet).getByRole('button', { name: /QR Code/ }));
        expect(onClose).toHaveBeenCalled();
        expect(onShowQR).toHaveBeenCalledWith(selected);
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
