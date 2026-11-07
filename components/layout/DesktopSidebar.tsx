import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Boxes,
    CalendarDays,
    Check,
    ChevronDown,
    ChevronUp,
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

// Filete de linha fina (8% do texto) usado em bordas e divisórias.
const HAIRLINE = 'border-slate-900/[0.08] dark:border-white/[0.08]';
const ICON_STROKE = 1.75;

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
            <div className="mx-auto my-2 h-px w-6 bg-slate-900/[0.08] dark:bg-white/[0.08]" aria-hidden="true" />
        ) : (
            <p className="mb-1 flex h-8 items-center px-3 text-xs font-medium text-[var(--text-muted)]">{label}</p>
        )
    );

    // Linha do menu: 36 px de altura. A tela aberta ganha só um fundo um tom
    // acima e o filete azul à esquerda (a "borda da película").
    const rowClass = (isActive: boolean) => [
        'group relative flex h-9 w-full items-center rounded-lg text-left transition-colors duration-150',
        isCollapsed ? 'justify-center px-0' : 'gap-3 px-3',
        isActive
            ? 'bg-slate-100 dark:bg-white/[0.07]'
            : 'hover:bg-slate-50 dark:hover:bg-white/[0.04]'
    ].join(' ');

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
                className={rowClass(isActive)}
            >
                {isActive ? (
                    <span
                        data-menu-active-marker
                        className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--brand-primary)]"
                        aria-hidden="true"
                    />
                ) : null}

                <Icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                        isActive
                            ? 'text-[var(--brand-primary)]'
                            : 'text-[var(--text-muted)] group-hover:text-[var(--text-body)]'
                    }`}
                    strokeWidth={ICON_STROKE}
                    aria-hidden="true"
                />

                {!isCollapsed ? (
                    <>
                        <span className={`min-w-0 flex-1 truncate text-sm font-medium ${isActive ? 'text-[var(--text-strong)]' : 'text-[var(--text-body)]'}`}>
                            {label}
                        </span>
                        {isInitial ? (
                            <span className="shrink-0 text-xs text-[var(--text-muted)]">Inicial</span>
                        ) : null}
                        {badge ? (
                            <span className="shrink-0 text-xs text-[var(--text-muted)]">{badge}</span>
                        ) : null}
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

        const moveButtonClass = `flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors duration-150 hover:bg-slate-100 hover:text-[var(--text-strong)] disabled:pointer-events-none disabled:opacity-30 dark:hover:bg-white/[0.06]`;

        return (
            <div
                key={tabId}
                ref={node => registerMenuRow(menuTabId, node)}
                className={[
                    'flex h-11 items-center gap-2 rounded-lg border bg-[var(--surface)] pl-1 pr-1 transition-[transform,box-shadow,border-color] duration-150 dark:bg-white/[0.03]',
                    draggingTabId === menuTabId
                        ? 'relative z-20 scale-[1.015] border-[var(--brand-primary)] shadow-[0_8px_24px_rgba(15,23,42,0.14)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.4)]'
                        : HAIRLINE
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
                    className="flex h-8 w-6 touch-none shrink-0 cursor-grab items-center justify-center rounded-md text-[var(--text-soft)] transition-colors hover:bg-slate-100 hover:text-[var(--text-body)] active:cursor-grabbing dark:hover:bg-white/[0.06]"
                >
                    <GripVertical className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} aria-hidden="true" />
                </button>
                <Icon className="h-4 w-4 shrink-0 text-[var(--text-muted)]" strokeWidth={ICON_STROKE} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-5 text-[var(--text-strong)]">{label}</p>
                    {isFirst ? (
                        <p className="text-xs leading-4 text-[var(--brand-primary)] dark:text-[var(--brand-primary-strong)]">
                            Tela inicial
                        </p>
                    ) : null}
                </div>
                <button
                    type="button"
                    onClick={() => handleMove(-1)}
                    disabled={isFirst}
                    aria-label={`Mover ${label} para cima, posição ${index + 1} de ${orderedMainNav.length}`}
                    className={moveButtonClass}
                >
                    <ChevronUp className="h-4 w-4" strokeWidth={ICON_STROKE} aria-hidden="true" />
                </button>
                <button
                    type="button"
                    onClick={() => handleMove(1)}
                    disabled={isLast}
                    aria-label={`Mover ${label} para baixo, posição ${index + 1} de ${orderedMainNav.length}`}
                    className={moveButtonClass}
                >
                    <ChevronDown className="h-4 w-4" strokeWidth={ICON_STROKE} aria-hidden="true" />
                </button>
            </div>
        );
    };

    const CollapseIcon = isCollapsed ? PanelLeftOpen : PanelLeftClose;

    return (
        <aside
            className={[
                `sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r ${HAIRLINE} bg-[var(--surface)] text-[var(--text-body)] lg:flex`,
                isCollapsed ? 'w-[76px]' : 'w-64'
            ].join(' ')}
        >
            <div
                className={[
                    `flex border-b ${HAIRLINE}`,
                    isCollapsed ? 'flex-col items-center gap-2 px-3 py-3' : 'h-16 items-center justify-between gap-3 px-4'
                ].join(' ')}
            >
                <div className={`flex min-w-0 items-center ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-primary)] text-white">
                        <Layers3 className="h-4 w-4" strokeWidth={ICON_STROKE} aria-hidden="true" />
                    </div>
                    {!isCollapsed ? (
                        <h1 className="truncate text-base font-semibold text-[var(--text-strong)]">
                            Películas<span className="text-[var(--brand-primary)] dark:text-[var(--brand-primary-strong)]">BR</span>
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
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors duration-150 hover:bg-slate-100 hover:text-[var(--text-strong)] dark:hover:bg-white/[0.06]"
                    aria-label={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
                    title={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
                >
                    <CollapseIcon className="h-4 w-4" strokeWidth={ICON_STROKE} aria-hidden="true" />
                </button>
            </div>

            <nav
                ref={navScrollRef}
                className="flex-grow overflow-y-auto px-3 py-3"
            >
                {isCollapsed ? (
                    renderSectionLabel('Principal')
                ) : (
                    <div className="mb-1 flex h-8 items-center justify-between gap-2 pl-3">
                        <p className="text-xs font-medium text-[var(--text-muted)]">
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
                            className={`flex h-7 items-center gap-1.5 rounded-md px-2 transition-colors duration-150 hover:bg-slate-100 dark:hover:bg-white/[0.06] ${
                                isEditingMenu
                                    ? 'text-[var(--brand-primary)] dark:text-[var(--brand-primary-strong)]'
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                            }`}
                        >
                            {isEditingMenu
                                ? <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                                : <Pencil className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} aria-hidden="true" />}
                            <span className="text-xs font-medium">{isEditingMenu ? 'Concluir' : 'Organizar'}</span>
                        </button>
                    </div>
                )}

                {isEditingMenu && !isCollapsed ? (
                    <>
                        <div className="mb-3 px-3 text-xs leading-5 text-[var(--text-muted)]">
                            <p>Arraste pelo puxador ou use as setas. O primeiro item será aberto ao iniciar o aplicativo.</p>
                            <button
                                type="button"
                                onClick={() => {
                                    cancelMenuItemDrag();
                                    onResetMenuOrder();
                                    setMenuAnnouncement('Ordem padrão restaurada. Dashboard é a tela inicial.');
                                }}
                                className="mt-1 text-[var(--brand-primary)] hover:underline dark:text-[var(--brand-primary-strong)]"
                            >
                                <span className="text-xs font-medium">Restaurar ordem padrão</span>
                            </button>
                        </div>
                        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                            {menuAnnouncement}
                        </p>
                        <div className="space-y-1">
                            {orderedMainNav.map(renderEditableNavItem)}
                        </div>
                    </>
                ) : (
                    <div className="space-y-0.5">
                        {visibleMainNav.map(item => (
                            <NavItem key={item.tabId} {...item} />
                        ))}
                    </div>
                )}

                <div className={`mt-4 border-t ${HAIRLINE} pt-4`}>
                    {renderSectionLabel('Sistema')}
                    <div className="space-y-0.5">
                        {systemNav.map(item => (
                            <NavItem key={item.tabId} {...item} />
                        ))}
                        <button
                            type="button"
                            onClick={() => setIsSupportOpen(true)}
                            aria-label="Suporte"
                            title={isCollapsed ? 'Suporte' : undefined}
                            className={rowClass(false)}
                        >
                            <Headset
                                className="h-4 w-4 shrink-0 text-[var(--text-muted)] transition-colors group-hover:text-[var(--text-body)]"
                                strokeWidth={ICON_STROKE}
                                aria-hidden="true"
                            />
                            {!isCollapsed ? (
                                <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text-body)]">Suporte</span>
                            ) : null}
                        </button>
                    </div>
                </div>
            </nav>

            <div className={`${isCollapsed ? 'items-center' : ''} flex flex-col gap-2 border-t ${HAIRLINE} px-3 py-3`}>
                <ThemeToggle variant="sidebar" compact={isCollapsed} />

                {!isCollapsed ? (
                    <div className="flex items-center justify-between px-1">
                        <SyncStatusIndicator />
                    </div>
                ) : null}

                <div
                    className={[
                        'flex items-center',
                        isCollapsed ? 'h-10 w-10 justify-center' : 'w-full gap-3 px-1 py-1'
                    ].join(' ')}
                    title={user?.email || userName}
                >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-xs font-semibold text-[var(--text-body)] ring-1 ring-inset ring-slate-900/[0.08] dark:bg-white/[0.06] dark:ring-white/[0.08]">
                        {companyLogo ? (
                            <img src={companyLogo} alt="Logo da empresa" className="h-full w-full object-cover" />
                        ) : (
                            initials
                        )}
                    </div>
                    {!isCollapsed ? (
                        <div className="min-w-0 flex-grow">
                            <p className="truncate text-sm font-medium leading-5 text-[var(--text-strong)]">
                                {userName}
                            </p>
                            <p className="truncate text-xs leading-4 text-[var(--text-muted)]">
                                {user?.email || ''}
                            </p>
                        </div>
                    ) : null}
                </div>

                <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    aria-label="Sair da conta"
                    title={isCollapsed ? 'Sair da conta' : undefined}
                    className={`${rowClass(false)} disabled:cursor-not-allowed disabled:opacity-60`}
                >
                    {isSigningOut ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--text-muted)]" aria-hidden="true" />
                    ) : (
                        <LogOut
                            className="h-4 w-4 shrink-0 text-[var(--text-muted)] transition-colors group-hover:text-[var(--text-body)]"
                            strokeWidth={ICON_STROKE}
                            aria-hidden="true"
                        />
                    )}

                    {!isCollapsed ? (
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text-body)]">
                            {isSigningOut ? 'Saindo…' : 'Sair da conta'}
                        </span>
                    ) : null}
                </button>
            </div>

            <SupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />
        </aside>
    );
};

export default React.memo(DesktopSidebar);
