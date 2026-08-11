import {
    DEFAULT_MENU_ORDER,
    getMenuOrderStorageKey,
    getPreferredStartTab,
    loadMenuOrder,
    moveMenuItem,
    moveMenuItemToIndex,
    normalizeMenuOrder,
    resetMenuOrder,
    saveMenuOrder
} from './menuPreferences';

describe('menuPreferences', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it('usa o menu padrao completo quando ainda nao existe preferencia', () => {
        expect(loadMenuOrder('user-a')).toEqual(DEFAULT_MENU_ORDER);
        expect(getPreferredStartTab('user-a')).toBe('dashboard');
    });

    it('move itens sem perder ou duplicar opcoes', () => {
        const moved = moveMenuItem(DEFAULT_MENU_ORDER, 'clients_list', -1);

        expect(moved.slice(0, 3)).toEqual(['clients_list', 'dashboard', 'client']);
        expect(new Set(moved)).toEqual(new Set(DEFAULT_MENU_ORDER));
        expect(moveMenuItem(moved, 'clients_list', -1)).toEqual(moved);
        expect(moveMenuItem(moved, 'fornecedores', 1)).toEqual(moved);
    });

    it('move um item diretamente para a posicao indicada durante o arraste', () => {
        const movedDown = moveMenuItemToIndex(DEFAULT_MENU_ORDER, 'dashboard', 3);
        expect(movedDown.slice(0, 4)).toEqual([
            'clients_list',
            'client',
            'proposals',
            'dashboard'
        ]);

        const movedUp = moveMenuItemToIndex(DEFAULT_MENU_ORDER, 'films', 1);
        expect(movedUp.slice(0, 4)).toEqual([
            'dashboard',
            'films',
            'clients_list',
            'client'
        ]);
        expect(moveMenuItemToIndex(DEFAULT_MENU_ORDER, 'fornecedores', -99)[0])
            .toBe('fornecedores');
        expect(moveMenuItemToIndex(DEFAULT_MENU_ORDER, 'dashboard', 999).at(-1))
            .toBe('dashboard');
        expect(new Set(movedDown)).toEqual(new Set(DEFAULT_MENU_ORDER));
    });

    it('normaliza valores antigos, repetidos ou desconhecidos', () => {
        const normalized = normalizeMenuOrder([
            'clients_list',
            'nao-existe',
            'clients_list',
            'client'
        ]);

        expect(normalized.slice(0, 3)).toEqual(['clients_list', 'client', 'dashboard']);
        expect(normalized).toHaveLength(DEFAULT_MENU_ORDER.length);
        expect(new Set(normalized)).toEqual(new Set(DEFAULT_MENU_ORDER));
    });

    it('isola a ordem por usuario e usa o primeiro item como tela inicial', () => {
        const userAOrder = moveMenuItem(DEFAULT_MENU_ORDER, 'clients_list', -1);
        const userBOrder = moveMenuItem(DEFAULT_MENU_ORDER, 'client', -1);

        saveMenuOrder('user-a', userAOrder);
        saveMenuOrder('user-b', userBOrder);

        expect(loadMenuOrder('user-a')).toEqual(userAOrder);
        expect(loadMenuOrder('user-b')).toEqual(userBOrder);
        expect(getPreferredStartTab('user-a')).toBe('clients_list');
        expect(getPreferredStartTab('user-b')).toBe('dashboard');
    });

    it('restaura somente o usuario solicitado', () => {
        saveMenuOrder('user-a', moveMenuItem(DEFAULT_MENU_ORDER, 'clients_list', -1));
        saveMenuOrder('user-b', moveMenuItem(DEFAULT_MENU_ORDER, 'client', -1));

        expect(resetMenuOrder('user-a')).toEqual(DEFAULT_MENU_ORDER);
        expect(loadMenuOrder('user-a')).toEqual(DEFAULT_MENU_ORDER);
        expect(loadMenuOrder('user-b')).not.toEqual(DEFAULT_MENU_ORDER);
    });

    it('ignora JSON corrompido sem quebrar a abertura do aplicativo', () => {
        window.localStorage.setItem(getMenuOrderStorageKey('user-a'), '{invalido');

        expect(loadMenuOrder('user-a')).toEqual(DEFAULT_MENU_ORDER);
    });
});
