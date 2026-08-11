import { fireEvent, render, screen } from '@testing-library/react';
import DesktopSidebar from './DesktopSidebar';
import { DEFAULT_MENU_ORDER, type MenuTabId } from '../../src/lib/menuPreferences';

vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({
        isAdmin: false,
        user: { id: 'user-a', email: 'alex@empresa.com' },
        signOut: vi.fn()
    })
}));

vi.mock('../../services/db', () => ({
    getUserInfo: vi.fn(() => new Promise(() => undefined))
}));

vi.mock('../../src/lib/waConnector', () => ({
    isWaConnectorEnabled: () => false
}));

vi.mock('../SyncStatusIndicator', () => ({ default: () => null }));
vi.mock('../ui/ThemeToggle', () => ({ default: () => <div>Tema</div> }));
vi.mock('../modals/SupportModal', () => ({ default: () => null }));

describe('DesktopSidebar - personalizacao do menu', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();
    });

    it('respeita a mesma ordem e oferece edicao por teclado ou clique', () => {
        const customOrder: MenuTabId[] = [
            'clients_list',
            ...DEFAULT_MENU_ORDER.filter(tabId => tabId !== 'clients_list')
        ];
        const onMenuOrderChange = vi.fn();
        const { container } = render(
            <DesktopSidebar
                activeTab="dashboard"
                onTabChange={vi.fn()}
                menuOrder={customOrder}
                onMenuOrderChange={onMenuOrderChange}
                onResetMenuOrder={vi.fn()}
            />
        );

        const visibleTabs = Array.from(container.querySelectorAll<HTMLElement>('[data-menu-tab]'))
            .map(element => element.dataset.menuTab);
        expect(visibleTabs.slice(0, customOrder.length)).toEqual(customOrder);

        expect(screen.getByRole('button', { name: 'Clientes' })).toHaveTextContent('Inicial');

        fireEvent.click(screen.getByRole('button', { name: 'Organizar menu' }));
        fireEvent.click(screen.getByRole('button', { name: /Mover Dashboard para cima/ }));

        expect(onMenuOrderChange).toHaveBeenCalledWith(DEFAULT_MENU_ORDER);
        expect(screen.getByRole('status')).toHaveTextContent('Dashboard: posição 1 de 11.');
    });

    it('reordena pelo puxador e confirma a mudanca somente ao soltar', () => {
        const onMenuOrderChange = vi.fn();
        const { container } = render(
            <DesktopSidebar
                activeTab="dashboard"
                onTabChange={vi.fn()}
                menuOrder={[...DEFAULT_MENU_ORDER]}
                onMenuOrderChange={onMenuOrderChange}
                onResetMenuOrder={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Organizar menu' }));
        const rows = Array.from(
            container.querySelectorAll<HTMLElement>('[data-menu-tab]')
        ).slice(0, DEFAULT_MENU_ORDER.length);
        rows.forEach((row, index) => {
            vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({
                x: 0,
                y: index * 46,
                top: index * 46,
                right: 256,
                bottom: index * 46 + 40,
                left: 0,
                width: 256,
                height: 40,
                toJSON: () => ({})
            });
        });

        const handle = screen.getByRole('button', { name: /Puxador de Dashboard/ });
        fireEvent.pointerDown(handle, {
            pointerId: 4,
            pointerType: 'mouse',
            button: 0,
            isPrimary: true,
            clientY: 8
        });
        fireEvent.pointerMove(handle, {
            pointerId: 4,
            pointerType: 'mouse',
            isPrimary: true,
            clientY: 120
        });

        expect(onMenuOrderChange).not.toHaveBeenCalled();

        fireEvent.pointerUp(handle, {
            pointerId: 4,
            pointerType: 'mouse',
            isPrimary: true,
            clientY: 120
        });

        expect(onMenuOrderChange).toHaveBeenCalledTimes(1);
        expect(onMenuOrderChange).toHaveBeenCalledWith([
            'clients_list',
            'client',
            'dashboard',
            ...DEFAULT_MENU_ORDER.slice(3)
        ]);
    });
});
