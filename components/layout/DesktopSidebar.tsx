import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowDown,
    ArrowUp,
    Boxes,
    CalendarDays,
    CircleUserRound,
    FileText,
    GripVertical,
    Headset,
    History,
    Layers3,
    LayoutDashboard,
    Loader2,
    LogOut,
    LucideIcon,
    MessageCircle,
    MessagesSquare,
    MapPinned,
    PanelLeftClose,
    PanelLeftOpen,
    Pencil,
    QrCode,
    Settings,
    ShieldUser,
    Truck,
    UsersRound
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isWaConnectorEnabled } from '../../src/lib/waConnector';
import SyncStatusIndicator from '../SyncStatusIndicator';
import ThemeToggle from '../ui/ThemeToggle';
import SupportModal from '../modals/SupportModal';
import * as db from '../../services/db';
import { moveMenuItem, type MenuTabId } from '../../src/lib/menuPreferences';
import { useMenuDragReorder } from '../../src/hooks/useMenuDragReorder';

type ActiveTab = 'dashboard' | 'client' | 'cliente_hub' | 'clients_list' | 'films' | 'settings' | 'history' | 'proposals' | 'agenda' | 'sales' | 'admin' | 'account' | 'estoque' | 'qr_code' | 'fornecedores' | 'saved_places' | 'wa_connector';

interface DesktopSidebarProps {
    activeTab: ActiveTab;
    onTabChange: (tab: ActiveTab) => void;
    menuOrder: readonly MenuTabId[];
    onMenuOrderChange: (order: MenuTabId[]) => void;
    onResetMenuOrder: () => void;
}

interface NavItemConfig {
    tabId: ActiveTab;
    icon: LucideIcon;
    label: string;
    badge?: string;
}

const MAIN_NAV: NavItemConfig[] = [
    { tabId: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { tabId: 'clients_list', icon: UsersRound, label: 'Clientes' },
    { tabId: 'client', icon: FileText, label: 'Orçamento' },
    { tabId: 'proposals', icon: MessagesSquare, label: 'Propostas' },
    { tabId: 'history', icon: History, label: 'Histórico' },
    { tabId: 'films', icon: Layers3, label: 'Películas' },
    { tabId: 'estoque', icon: Boxes, label: 'Estoque' },
    { tabId: 'qr_code', icon: QrCode, label: 'QR Code' },
    { tabId: 'agenda', icon: CalendarDays, label: 'Agenda' },
    { tabId: 'saved_places', icon: MapPinned, label: 'Meus locais' },
    { tabId: 'fornecedores', icon: Truck, label: 'Fornecedores' }
];

const MAIN_NAV_BY_TAB = new Map<MenuTabId, NavItemConfig>(
    MAIN_NAV.map(item => [item.tabId as MenuTabId, item])
);

const getMainNavItemLabel = (tabId: MenuTabId) =>
    MAIN_NAV_BY_TAB.get(tabId)?.label ?? 'Item';

const SIDEBAR_COLLAPSED_KEY = 'peliculas-br-sidebar-collapsed';

const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
    activeTab,
    onTabChange,
    menuOrder,
    onMenuOrderChange,
    onResetMenuOrder
}) => {
    const { isAdmin, user, signOut } = useAuth();
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [isSupportOpen, setIsSupportOpen] = useState(false);
    const [companyLogo, setCompanyLogo] = useState<string | undefined>(undefined);
    const [isEditingMenu, setIsEditingMenu] = useState(false);
    const [menuAnnouncement, setMenuAnnouncement] = useState('');
    const navScrollRef = useRef<HTMLElement | null>(null);

    const {
        displayOrder: displayedMenuOrder,
        draggingTabId,
        registerRow: registerMenuRow,
        handlePointerDown: handleMenuItemPointerDown,
        handlePointerMove: handleMenuItemPointerMove,
        handlePointerUp: handleMenuItemPointerUp,
        handlePointerCancel: handleMenuItemPointerCancel,
        cancelDrag: cancelMenuItemDrag
    } = useMenuDragReorder({
        order: menuOrder,
        enabled: isEditingMenu,
        onCommit: onMenuOrderChange,
        onAnnounce: setMenuAnnouncement,
        getItemLabel: getMainNavItemLabel,
        scrollRef: navScrollRef
    });

    useEffect(() => {
        let active = true;
        db.getUserInfo()
            .then(info => { if (active) setCompanyLogo(info?.logo || undefined); })
            .catch(() => { /* sem logo: mantem as iniciais */ });
        return () => { active = false; };
    }, []);
    const [isCollapsed, setIsCollapsed] = useState(() => {
        try {
            return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
        } catch {
            return false;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
        } catch {
            // Mantém o estado apenas em memória se o navegador bloquear storage.
        }
    }, [isCollapsed]);

    useEffect(() => {
        if (!draggingTabId) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') cancelMenuItemDrag();
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [cancelMenuItemDrag, draggingTabId]);

    const initials = (user?.email || 'U')
        .split('@')[0]
        .slice(0, 2)
        .toUpperCase();

    const userName = user?.email?.split('@')[0] || 'Usuário';

    const systemNav: NavItemConfig[] = useMemo(
        () => [
            ...(isAdmin ? [{ tabId: 'admin' as ActiveTab, icon: ShieldUser, label: 'Admin' }] : []),
            { tabId: 'settings', icon: Settings, label: 'Configurações' },
            { tabId: 'account', icon: CircleUserRound, label: 'Minha Conta' }
        ],
        [isAdmin]
    );

    const orderedMainNav = useMemo(
        () => displayedMenuOrder
            .map(tabId => MAIN_NAV_BY_TAB.get(tabId))
            .filter((item): item is NavItemConfig => Boolean(item)),
        [displayedMenuOrder]
    );

    const visibleMainNav = useMemo(
        () => [
            ...orderedMainNav,
            ...(isWaConnectorEnabled()
                ? [{ tabId: 'wa_connector' as ActiveTab, icon: MessageCircle, label: 'WhatsApp', badge: 'Local' }]
                : [])
        ],
        [orderedMainNav]
    );

    const handleSignOut = async () => {
        if (isSigningOut) return;

        setIsSigningOut(true);
        try {
            await signOut();
        } finally {
            setIsSigningOut(false);
        }
    };

    const renderSectionLabel = (label: string) => (
        isCollapsed ? (
            <div className="mx-auto my-2 h-px w-8 bg-[var(--border-subtle)] dark:bg-white/10" aria-hidden="true" />
        ) : (
            <p className="ui-kicker mb-2 px-3 text-[var(--text-soft)] dark:text-slate-500">{label}</p>
        )
    );

    const NavItem: React.FC<NavItemConfig> = ({ tabId, icon: Icon, label, badge }) => {
        const isActive = activeTab === tabId;
        const isInitial = tabId === displayedMenuOrder[0];

        return (
            <button
                type="button"
                data-tour={`nav-${tabId}`}
                data-menu-tab={tabId}
                onClick={() => onTabChange(tabId)}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                title={isCollapsed ? label : undefined}
                className={[
                    'group relative flex h-10 w-full items-center rounded-[var(--radius-control)] text-left transition-colors duration-200',
                    isCollapsed ? 'justify-center px-0' : 'gap-3 px-3',
                    isActive
                        ? 'border border-[var(--border-subtle)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)] shadow-[var(--shadow-hairline)] dark:border-white/10 dark:bg-white/[0.075] dark:text-white'
                        : 'border border-transparent text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)] dark:text-slate-400 dark:hover:bg-white/[0.055] dark:hover:text-slate-100'
                ].join(' ')}
            >
                {isActive ? (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-[var(--brand-primary)] dark:bg-blue-300" />
                ) : null}

                <Icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                        isActive
                            ? 'text-[var(--brand-primary)] dark:text-blue-300'
                            : 'text-[var(--text-soft)] group-hover:text-[var(--text-strong)] dark:text-slate-500 dark:group-hover:text-slate-300'
                    }`}
                    aria-hidden="true"
                />

                {!isCollapsed ? (
                    <>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{label}</span>
                        <span className="flex shrink-0 items-center gap-1.5">
                            {isInitial ? (
                                <span className="rounded-full border border-blue-200/80 bg-blue-50 px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-blue-700 dark:border-blue-300/20 dark:bg-blue-400/10 dark:text-blue-200">
                                    Inicial
                                </span>
                            ) : null}
                            {badge ? (
                                <span className="rounded-full bg-blue-100 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-blue-600 dark:bg-blue-500/20 dark:text-blue-300">
                                    {badge}
                                </span>
                            ) : null}
                            {isActive ? (
                                <span
                                    data-menu-active-marker
                                    className="h-1.5 w-1.5 rounded-full bg-[var(--brand-primary)] dark:bg-blue-300"
                                    aria-hidden="true"
                                />
                            ) : null}
                        </span>
                    </>
                ) : null}
            </button>
        );
    };

    const renderEditableNavItem = (item: NavItemConfig, index: number) => {
        const { tabId, icon: Icon, label } = item;
        const menuTabId = tabId as MenuTabId;
        const isFirst = index === 0;
        const isLast = index === orderedMainNav.length - 1;

        const handleMove = (direction: -1 | 1) => {
            const nextOrder = moveMenuItem(displayedMenuOrder, menuTabId, direction);
            const nextPosition = nextOrder.indexOf(menuTabId) + 1;
            onMenuOrderChange(nextOrder);
            setMenuAnnouncement(`${label}: posição ${nextPosition} de ${nextOrder.length}.`);
        };

        return (
            <div
                key={tabId}
                ref={node => registerMenuRow(menuTabId, node)}
                className={[
                    'flex min-h-11 items-center gap-1 rounded-[var(--radius-control)] border bg-[var(--surface-muted)] px-1.5 transition-[transform,box-shadow,border-color] dark:bg-white/[0.045]',
                    draggingTabId === menuTabId
                        ? 'relative z-20 scale-[1.015] border-blue-400 shadow-[0_10px_24px_rgba(37,99,235,0.18)] dark:border-blue-300/60'
                        : 'border-[var(--border-subtle)] dark:border-white/10'
                ].join(' ')}
                data-menu-tab={tabId}
                data-menu-dragging={draggingTabId === menuTabId ? 'true' : undefined}
            >
                <button
                    type="button"
                    data-menu-drag-handle
                    aria-label={`Puxador de ${label}. Arraste ou use as setas para mudar a posição.`}
                    onPointerDown={event => handleMenuItemPointerDown(event, menuTabId)}
                    onPointerMove={handleMenuItemPointerMove}
                    onPointerUp={handleMenuItemPointerUp}
                    onPointerCancel={handleMenuItemPointerCancel}
                    onKeyDown={event => {
                        if (event.key === 'ArrowUp' && !isFirst) {
                            event.preventDefault();
                            handleMove(-1);
                        } else if (event.key === 'ArrowDown' && !isLast) {
                            event.preventDefault();
                            handleMove(1);
                        }
                    }}
                    className="flex h-8 w-7 touch-none shrink-0 cursor-grab items-center justify-center rounded-lg text-[var(--text-soft)] hover:bg-[var(--surface)] hover:text-[var(--brand-primary)] active:cursor-grabbing dark:hover:bg-white/[0.06] dark:hover:text-blue-200"
                >
                    <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <Icon className="h-4 w-4 shrink-0 text-[var(--brand-primary)] dark:text-blue-300" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-[var(--text-strong)] dark:text-white">{label}</p>
                    {isFirst ? (
                        <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--brand-primary)] dark:text-blue-300">
                            Tela inicial
                        </p>
                    ) : null}
                </div>
                <button
                    type="button"
                    onClick={() => handleMove(-1)}
                    disabled={isFirst}
                    aria-label={`Mover ${label} para cima, posição ${index + 1} de ${orderedMainNav.length}`}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] disabled:opacity-25 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-200"
                >
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    onClick={() => handleMove(1)}
                    disabled={isLast}
                    aria-label={`Mover ${label} para baixo, posição ${index + 1} de ${orderedMainNav.length}`}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] disabled:opacity-25 dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-200"
                >
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
            </div>
        );
    };

    const CollapseIcon = isCollapsed ? PanelLeftOpen : PanelLeftClose;

    return (
        <aside
            className={[
                'sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-body)] shadow-[var(--shadow-hairline)] transition-[width,background-color,border-color] duration-300 lg:flex dark:bg-[#07111f] dark:text-white',
                isCollapsed ? 'w-[76px]' : 'w-64'
            ].join(' ')}
        >
            <div className={`${isCollapsed ? 'px-3 py-4' : 'px-4 py-4'} border-b border-[var(--border-subtle)] dark:border-white/10`}>
                <div className={`flex items-center ${isCollapsed ? 'flex-col gap-3' : 'justify-between gap-3'}`}>
                    <div className={`flex min-w-0 items-center ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}>
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--brand-primary)] text-white shadow-[0_12px_24px_rgba(21,94,239,0.24)]">
                            <Layers3 className="h-4 w-4" aria-hidden="true" />
                        </div>
                        {!isCollapsed ? (
                            <h1 className="truncate text-lg font-semibold tracking-normal text-[var(--text-strong)] dark:text-white">
                                Películas<span className="text-[var(--brand-primary)] dark:text-blue-300">BR</span>
                            </h1>
                        ) : null}
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            cancelMenuItemDrag();
                            setIsEditingMenu(false);
                            setIsCollapsed(current => !current);
                        }}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)] shadow-[var(--shadow-hairline)] transition-all duration-200 hover:bg-[var(--surface)] hover:text-[var(--brand-primary)] dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-400 dark:hover:bg-white/[0.08] dark:hover:text-blue-200"
                        aria-label={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
                        title={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
                    >
                        <CollapseIcon className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>
            </div>

            <nav
                ref={navScrollRef}
                className={`${isCollapsed ? 'px-3' : 'px-3'} flex-grow space-y-1 overflow-y-auto py-4`}
            >
                {isCollapsed ? (
                    renderSectionLabel('Principal')
                ) : (
                    <div className="mb-2 flex items-center justify-between gap-2 px-3">
                        <p className="ui-kicker text-[var(--text-soft)] dark:text-slate-500">
                            {isEditingMenu ? 'Organizar menu' : 'Principal'}
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                if (isEditingMenu) cancelMenuItemDrag();
                                setIsEditingMenu(current => !current);
                            }}
                            aria-label={isEditingMenu ? 'Concluir organização do menu' : 'Organizar menu'}
                            aria-pressed={isEditingMenu}
                            className="flex h-7 items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2.5 text-[10px] font-bold text-[var(--brand-primary)] transition-colors hover:bg-[var(--brand-primary-soft)] dark:border-white/10 dark:bg-white/[0.045] dark:text-blue-300"
                        >
                            <Pencil className="h-3 w-3" aria-hidden="true" />
                            {isEditingMenu ? 'Concluir' : 'Organizar'}
                        </button>
                    </div>
                )}

                {isEditingMenu && !isCollapsed ? (
                    <>
                        <div className="mx-1 mb-2 rounded-[var(--radius-control)] bg-[var(--brand-primary-soft)] px-3 py-2 text-[10px] leading-relaxed text-[var(--brand-primary)] dark:bg-blue-400/10 dark:text-blue-200">
                            <p>Arraste pelo puxador ou use as setas. O primeiro item será aberto ao iniciar o aplicativo.</p>
                            <button
                                type="button"
                                onClick={() => {
                                    cancelMenuItemDrag();
                                    onResetMenuOrder();
                                    setMenuAnnouncement('Ordem padrão restaurada. Dashboard é a tela inicial.');
                                }}
                                className="mt-1 font-bold underline underline-offset-2"
                            >
                                Restaurar ordem padrão
                            </button>
                        </div>
                        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                            {menuAnnouncement}
                        </p>
                        {orderedMainNav.map(renderEditableNavItem)}
                    </>
                ) : (
                    visibleMainNav.map(item => (
                        <NavItem key={item.tabId} {...item} />
                    ))
                )}

                <div className="mt-3 space-y-1 border-t border-[var(--border-subtle)] pt-3 dark:border-white/10">
                    {renderSectionLabel('Sistema')}
                    {systemNav.map(item => (
                        <NavItem key={item.tabId} {...item} />
                    ))}
                    <button
                        type="button"
                        onClick={() => setIsSupportOpen(true)}
                        aria-label="Suporte"
                        title={isCollapsed ? 'Suporte' : undefined}
                        className={[
                            'group relative flex h-10 w-full items-center rounded-[var(--radius-control)] border border-transparent text-left text-[var(--text-muted)] transition-colors duration-200 hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)] dark:text-slate-400 dark:hover:bg-white/[0.055] dark:hover:text-slate-100',
                            isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'
                        ].join(' ')}
                    >
                        <Headset
                            className="h-4 w-4 shrink-0 text-[var(--text-soft)] transition-colors group-hover:text-[var(--text-strong)] dark:text-slate-500 dark:group-hover:text-slate-300"
                            aria-hidden="true"
                        />
                        {!isCollapsed ? (
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold">Suporte</span>
                        ) : null}
                    </button>
                </div>
            </nav>

            <div className={`${isCollapsed ? 'items-center px-3' : 'px-4'} flex flex-col gap-3 border-t border-[var(--border-subtle)] py-4 dark:border-white/10`}>
                <ThemeToggle variant="sidebar" compact={isCollapsed} />

                {!isCollapsed ? (
                    <div className="flex items-center justify-between px-1">
                        <SyncStatusIndicator />
                    </div>
                ) : null}

                <div
                    className={[
                        'flex cursor-default items-center rounded-[var(--radius-control)] transition-colors hover:bg-[var(--surface-muted)] dark:hover:bg-white/[0.055]',
                        isCollapsed ? 'h-10 w-10 justify-center p-0' : 'w-full gap-3 p-2'
                    ].join(' ')}
                    title={user?.email || userName}
                >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-control)] bg-[var(--brand-primary)] text-xs font-bold text-white shadow-[0_10px_22px_rgba(37,99,235,0.22)]">
                        {companyLogo ? (
                            <img src={companyLogo} alt="Logo da empresa" className="h-full w-full object-cover" />
                        ) : (
                            initials
                        )}
                    </div>
                    {!isCollapsed ? (
                        <div className="min-w-0 flex-grow">
                            <p className="truncate text-sm font-semibold leading-tight text-[var(--text-strong)] dark:text-white">
                                {userName}
                            </p>
                            <p className="mt-0.5 truncate text-[10px] text-[var(--text-muted)] dark:text-slate-500">
                                {user?.email || ''}
                            </p>
                        </div>
                    ) : null}
                </div>

                <div className={`${isCollapsed ? 'w-10' : 'w-full'} border-t border-[var(--border-subtle)] pt-3 dark:border-white/10`}>
                    <button
                        type="button"
                        onClick={handleSignOut}
                        disabled={isSigningOut}
                        aria-label="Sair da aplicação"
                        title={isCollapsed ? 'Sair da aplicação' : undefined}
                        className={[
                            'group flex h-10 w-full items-center rounded-[var(--radius-control)] border border-transparent text-[var(--text-muted)] transition-all duration-200 hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-400 dark:hover:border-red-400/20 dark:hover:bg-red-500/10 dark:hover:text-red-200',
                            isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'
                        ].join(' ')}
                    >
                        {isSigningOut ? (
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
                        ) : (
                            <LogOut className="h-4 w-4 shrink-0 text-[var(--text-soft)] transition-colors group-hover:text-red-700 dark:text-slate-500 dark:group-hover:text-red-200" aria-hidden="true" />
                        )}

                        {!isCollapsed ? (
                            <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold">
                                {isSigningOut ? 'Saindo...' : 'Sair'}
                            </span>
                        ) : null}
                    </button>
                </div>
            </div>

            <SupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />
        </aside>
    );
};

export default React.memo(DesktopSidebar);
