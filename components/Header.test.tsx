import { fireEvent, render, screen, within } from '@testing-library/react';
import Header from './Header';
import { DEFAULT_MENU_ORDER, type MenuTabId } from '../src/lib/menuPreferences';

vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({
        isAdmin: false,
        user: { id: 'user-a', email: 'alex@empresa.com' },
        signOut: vi.fn()
    })
}));

vi.mock('../services/db', () => ({
    getUserInfo: vi.fn(() => new Promise(() => undefined))
}));

vi.mock('../src/lib/waConnector', () => ({
    isWaConnectorEnabled: () => false
}));

vi.mock('./SyncStatusIndicator', () => ({ default: () => null }));
vi.mock('./GlobalNotificationBell', () => ({ default: () => null }));
vi.mock('./ui/ThemeToggle', () => ({ default: () => <div>Tema</div> }));
vi.mock('./modals/SupportModal', () => ({ default: () => null }));

describe('Header - personalizacao do menu', () => {
    const renderHeader = (options?: { menuOrder?: MenuTabId[] }) => {
        const onTabChange = vi.fn();
        const onMenuOrderChange = vi.fn();
        const onResetMenuOrder = vi.fn();

        render(
            <Header
                activeTab="dashboard"
                onTabChange={onTabChange}
                menuOrder={options?.menuOrder ?? [...DEFAULT_MENU_ORDER]}
                onMenuOrderChange={onMenuOrderChange}
                onResetMenuOrder={onResetMenuOrder}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));

        return {
            dialog: screen.getByRole('dialog', { name: 'Menu principal' }),
            onTabChange,
            onMenuOrderChange,
            onResetMenuOrder
        };
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('mantem o acionador fora da area nativa do iPhone e com alvo de toque adequado', () => {
        renderHeader();

        const trigger = screen.getByRole('button', { name: 'Abrir menu' });
        const mobileHeader = trigger.closest('[data-app-mobile-header]');

        expect(mobileHeader).toHaveClass('pt-[env(safe-area-inset-top,0px)]', 'lg:pt-0');
        expect(trigger).toHaveClass('h-11', 'w-11', 'touch-manipulation');
        expect(trigger).toHaveAttribute('type', 'button');
    });

    it('mostra a ordem recebida igualmente na navegacao', () => {
        const customOrder: MenuTabId[] = [
            'clients_list',
            ...DEFAULT_MENU_ORDER.filter(tabId => tabId !== 'clients_list')
        ];
        const { dialog } = renderHeader({ menuOrder: customOrder });
        const renderedTabs = Array.from(dialog.querySelectorAll<HTMLElement>('[data-menu-tab]'))
            .map(element => element.dataset.menuTab);

        expect(renderedTabs.slice(0, customOrder.length)).toEqual(customOrder);
    });

    it('move um item com controles acessiveis sem navegar', () => {
        const { dialog, onTabChange, onMenuOrderChange } = renderHeader();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Organizar menu' }));
        fireEvent.click(within(dialog).getByRole('button', { name: /Mover Clientes para cima/ }));

        expect(onMenuOrderChange).toHaveBeenCalledWith([
            'clients_list',
            'dashboard',
            ...DEFAULT_MENU_ORDER.slice(2)
        ]);
        expect(onTabChange).not.toHaveBeenCalled();
        expect(within(dialog).getByRole('status')).toHaveTextContent(
            'Clientes: posição 1 de 11.'
        );
    });

    it('explica a tela inicial e permite restaurar o padrao', () => {
        const { dialog, onResetMenuOrder } = renderHeader();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Organizar menu' }));

        const dashboardRow = dialog.querySelector<HTMLElement>('[data-menu-tab="dashboard"]');
        expect(dashboardRow).toHaveTextContent('Tela inicial');
        expect(within(dialog).getByText(
            /O primeiro item será aberto ao iniciar o aplicativo\./
        )).toBeInTheDocument();

        fireEvent.click(within(dialog).getByRole('button', { name: 'Restaurar ordem padrão' }));
        expect(onResetMenuOrder).toHaveBeenCalledTimes(1);
        expect(within(dialog).getByRole('status')).toHaveTextContent(
            'Ordem padrão restaurada. Dashboard é a tela inicial.'
        );
    });

    it('diferencia a tela inicial personalizada da tela atualmente aberta', () => {
        const customOrder: MenuTabId[] = [
            'clients_list',
            ...DEFAULT_MENU_ORDER.filter(tabId => tabId !== 'clients_list')
        ];
        const { dialog } = renderHeader({ menuOrder: customOrder });
        const clientsRow = dialog.querySelector<HTMLElement>('[data-menu-tab="clients_list"]');
        const dashboardRow = dialog.querySelector<HTMLElement>('[data-menu-tab="dashboard"]');

        expect(clientsRow).not.toBeNull();
        expect(dashboardRow).not.toBeNull();
        expect(within(clientsRow!).getByText('Inicial')).toBeInTheDocument();
        expect(clientsRow).not.toHaveAttribute('aria-current');
        expect(dashboardRow).toHaveAttribute('aria-current', 'page');
        expect(dashboardRow?.querySelector('[data-menu-active-marker]')).not.toBeNull();
    });

    it('mostra e remove a indicacao de mais itens conforme a rolagem', () => {
        const { dialog } = renderHeader();
        const scrollArea = dialog.querySelector<HTMLElement>('[data-menu-scroll-area]');

        expect(scrollArea).not.toBeNull();
        Object.defineProperties(scrollArea!, {
            scrollHeight: { configurable: true, value: 1000 },
            clientHeight: { configurable: true, value: 400 },
            scrollTop: { configurable: true, writable: true, value: 0 }
        });

        fireEvent.scroll(scrollArea!);
        expect(dialog.querySelector('[data-menu-scroll-more]')).not.toBeNull();

        scrollArea!.scrollTop = 600;
        fireEvent.scroll(scrollArea!);
        expect(dialog.querySelector('[data-menu-scroll-more]')).toBeNull();
    });

    it('reordena por arraste e salva somente quando o item e solto', () => {
        const { dialog, onMenuOrderChange, onTabChange } = renderHeader();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Organizar menu' }));

        const rows = Array.from(
            dialog.querySelectorAll<HTMLElement>('[data-menu-tab]')
        ).slice(0, DEFAULT_MENU_ORDER.length);
        rows.forEach((row, index) => {
            vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({
                x: 0,
                y: index * 50,
                top: index * 50,
                right: 300,
                bottom: index * 50 + 44,
                left: 0,
                width: 300,
                height: 44,
                toJSON: () => ({})
            });
        });

        const dashboardHandle = within(dialog).getByRole('button', {
            name: /Puxador de Dashboard/
        });
        fireEvent.pointerDown(dashboardHandle, {
            pointerId: 7,
            pointerType: 'touch',
            isPrimary: true,
            clientY: 10
        });
        fireEvent.pointerMove(dashboardHandle, {
            pointerId: 7,
            pointerType: 'touch',
            isPrimary: true,
            clientY: 130
        });

        expect(onMenuOrderChange).not.toHaveBeenCalled();

        fireEvent.pointerUp(dashboardHandle, {
            pointerId: 7,
            pointerType: 'touch',
            isPrimary: true,
            clientY: 130
        });

        expect(onMenuOrderChange).toHaveBeenCalledTimes(1);
        expect(onMenuOrderChange).toHaveBeenCalledWith([
            'clients_list',
            'client',
            'dashboard',
            ...DEFAULT_MENU_ORDER.slice(3)
        ]);
        expect(onTabChange).not.toHaveBeenCalled();
    });

    it('cancela o arraste sem salvar a ordem provisoria', () => {
        const { dialog, onMenuOrderChange } = renderHeader();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Organizar menu' }));

        const rows = Array.from(
            dialog.querySelectorAll<HTMLElement>('[data-menu-tab]')
        ).slice(0, DEFAULT_MENU_ORDER.length);
        rows.forEach((row, index) => {
            vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({
                x: 0,
                y: index * 50,
                top: index * 50,
                right: 300,
                bottom: index * 50 + 44,
                left: 0,
                width: 300,
                height: 44,
                toJSON: () => ({})
            });
        });

        const handle = within(dialog).getByRole('button', { name: /Puxador de Dashboard/ });
        fireEvent.pointerDown(handle, {
            pointerId: 9,
            pointerType: 'touch',
            isPrimary: true,
            clientY: 10
        });
        expect(within(dialog).getByRole('status')).toHaveTextContent(
            'Dashboard selecionado para organizar.'
        );
        fireEvent.pointerMove(handle, {
            pointerId: 9,
            pointerType: 'touch',
            isPrimary: true,
            clientY: 130
        });
        fireEvent.pointerCancel(handle, {
            pointerId: 9,
            pointerType: 'touch',
            isPrimary: true,
            clientY: 130
        });

        expect(onMenuOrderChange).not.toHaveBeenCalled();
        expect(within(dialog).getByRole('status')).toHaveTextContent(
            'Organização de Dashboard cancelada.'
        );
    });
});
