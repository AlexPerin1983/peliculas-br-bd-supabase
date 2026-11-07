import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
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
    LogOut,
    type LucideIcon,
    MapPinned,
    MessageCircle,
    MessagesSquare,
    Pencil,
    QrCode,
    Settings,
    Share2,
    ShieldUser,
    Truck,
    UsersRound
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import SyncStatusIndicator from './SyncStatusIndicator';
import ThemeToggle from './ui/ThemeToggle';
import SupportModal from './modals/SupportModal';
import { isWaConnectorEnabled } from '../src/lib/waConnector';
import {
    moveMenuItem,
    type MenuTabId
} from '../src/lib/menuPreferences';
import { useMenuDragReorder } from '../src/hooks/useMenuDragReorder';
import * as db from '../services/db';
import GlobalNotificationBell from './GlobalNotificationBell';
import CompanyShareSheet from './modals/CompanyShareSheet';
import type { UserInfo } from '../types';

type ActiveTab =
    | 'dashboard'
    | 'client'
    | 'cliente_hub'
    | 'clients_list'
    | 'films'
    | 'settings'
    | 'history'
    | 'proposals'
    | 'agenda'
    | 'sales'
    | 'admin'
    | 'account'
    | 'estoque'
    | 'qr_code'
    | 'fornecedores'
    | 'saved_places'
    | 'wa_connector';

interface HeaderProps {
    activeTab: ActiveTab;
    onTabChange: (tab: ActiveTab) => void;
    menuOrder: readonly MenuTabId[];
    onMenuOrderChange: (order: MenuTabId[]) => void;
    onResetMenuOrder: () => void;
    onGoBack?: () => void;
    canGoBack?: boolean;
    onMenuOpenChange?: (isOpen: boolean) => void;
    closeMenuRequest?: number;
}

interface NavItem {
    tabId: ActiveTab;
    icon: LucideIcon;
    label: string;
    hint: string;
    badge?: string;
}

// Itens principais personalizaveis. A ordem inicial preserva o menu conhecido;
// conta, configuracoes e acoes operacionais continuam fixas em "Sistema".
// Os ícones são os mesmos da barra lateral do computador.
const SECTION_GERAL: NavItem[] = [
    { tabId: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', hint: 'visao geral do negocio' },
];

const SECTION_VENDAS: NavItem[] = [
    { tabId: 'clients_list', icon: UsersRound, label: 'Clientes', hint: 'cadastro e histórico' },
    { tabId: 'client', icon: FileText, label: 'Orçamento', hint: 'montar e enviar' },
    { tabId: 'proposals', icon: MessagesSquare, label: 'Propostas', hint: 'respostas e negociações' },
    { tabId: 'history', icon: History, label: 'Histórico', hint: 'registros, PDFs e consultas' },
    { tabId: 'films', icon: Layers3, label: 'Películas', hint: 'catálogo e seleção' },
];

const SECTION_OPERACAO: NavItem[] = [
    { tabId: 'agenda', icon: CalendarDays, label: 'Agenda', hint: 'visitas, prazos e tarefas' },
    { tabId: 'saved_places', icon: MapPinned, label: 'Meus locais', hint: 'endereços e rotas favoritas' },
    { tabId: 'estoque', icon: Boxes, label: 'Estoque', hint: 'bobinas, retalhos e status' },
    { tabId: 'qr_code', icon: QrCode, label: 'QR Code', hint: 'rótulos e leitura rápida' },
    { tabId: 'fornecedores', icon: Truck, label: 'Fornecedores', hint: 'compras, contatos e apoio' },
];

const SECTION_SISTEMA: NavItem[] = [
    { tabId: 'settings', icon: Settings, label: 'Configurações', hint: 'preferências e ajustes do app' },
    { tabId: 'account', icon: CircleUserRound, label: 'Minha Conta', hint: 'perfil, acesso e segurança' },
];

// Filete de linha fina (8% do texto) usado em bordas e divisórias do menu.
const HAIRLINE = 'border-slate-900/[0.08] dark:border-white/[0.08]';
const ICON_STROKE = 1.75;

const PRIMARY_NAV_ITEMS = [
    ...SECTION_GERAL,
    ...SECTION_VENDAS,
    ...SECTION_OPERACAO
];

const PRIMARY_NAV_BY_TAB = new Map<MenuTabId, NavItem>(
    PRIMARY_NAV_ITEMS.map(item => [item.tabId as MenuTabId, item])
);

const getPrimaryNavItemLabel = (tabId: MenuTabId) =>
    PRIMARY_NAV_BY_TAB.get(tabId)?.label ?? 'Item';

const pageLabels: Record<string, string> = {
    dashboard: 'Dashboard',
    clients_list: 'Clientes',
    client: 'Orçamento',
    cliente_hub: 'Ficha do cliente',
    films: 'Películas',
    estoque: 'Estoque',
    qr_code: 'QR Code',
    agenda: 'Agenda',
    saved_places: 'Meus locais',
    proposals: 'Propostas',
    history: 'Histórico',
    fornecedores: 'Fornecedores',
    admin: 'Admin',
    settings: 'Configurações',
    account: 'Minha Conta',
    wa_connector: 'WhatsApp',
};

type MenuRenderState = 'closed' | 'opening' | 'open' | 'closing';
const SWIPE_CLOSE_THRESHOLD = 72;
const MAX_SWIPE_TRANSLATE = 240;

const Header: React.FC<HeaderProps> = ({
    activeTab,
    onTabChange,
    menuOrder,
    onMenuOrderChange,
    onResetMenuOrder,
    onGoBack,
    canGoBack = false,
    onMenuOpenChange,
    closeMenuRequest = 0,
}) => {
    const { isAdmin, user, signOut } = useAuth();
    const [menuState, setMenuState] = useState<MenuRenderState>('closed');
    const [isSupportOpen, setIsSupportOpen] = useState(false);
    const [isEditingMenu, setIsEditingMenu] = useState(false);
    const [menuAnnouncement, setMenuAnnouncement] = useState('');
    const [hasMoreNavContent, setHasMoreNavContent] = useState(false);
    const [companyInfo, setCompanyInfo] = useState<UserInfo | null>(null);
    const [isCompanyShareOpen, setIsCompanyShareOpen] = useState(false);
    const [dragOffsetX, setDragOffsetX] = useState(0);
    const [isDraggingMenu, setIsDraggingMenu] = useState(false);
    const [shellMetrics, setShellMetrics] = useState({ width: 336, height: 880 });
    const touchStateRef = useRef({
        startX: 0,
        startY: 0,
        dragging: false,
        tracking: false,
    });
    const shellRef = useRef<HTMLElement | null>(null);
    const navScrollRef = useRef<HTMLDivElement | null>(null);

    const updateNavScrollIndicator = React.useCallback(() => {
        const node = navScrollRef.current;
        if (!node) {
            setHasMoreNavContent(false);
            return;
        }

        const hasContentBelow = node.scrollHeight - node.scrollTop - node.clientHeight > 2;
        setHasMoreNavContent(current => (
            current === hasContentBelow ? current : hasContentBelow
        ));
    }, []);

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
        getItemLabel: getPrimaryNavItemLabel,
        scrollRef: navScrollRef,
        onAutoScroll: updateNavScrollIndicator
    });

    const isMenuMounted = menuState !== 'closed';

    useEffect(() => {
        onMenuOpenChange?.(isMenuMounted);

        return () => {
            if (isMenuMounted) onMenuOpenChange?.(false);
        };
    }, [isMenuMounted, onMenuOpenChange]);

    useEffect(() => {
        if (closeMenuRequest > 0) {
            cancelMenuItemDrag();
            setMenuState(current => (current === 'closed' ? current : 'closing'));
        }
    }, [cancelMenuItemDrag, closeMenuRequest]);
    const isMenuVisible = menuState === 'open';

    useEffect(() => {
        document.body.style.overflow = isMenuMounted ? 'hidden' : '';
        return () => {
            document.body.style.overflow = '';
        };
    }, [isMenuMounted]);

    // Carrega os dados da empresa ao abrir o menu. Eles alimentam o cabeçalho
    // e a ficha de compartilhamento sem criar uma segunda fonte de verdade.
    useEffect(() => {
        if (!isMenuMounted) return;
        let active = true;
        db.getUserInfo()
            .then(info => { if (active) setCompanyInfo(info || null); })
            .catch(() => { /* usa os dados básicos da sessão como fallback */ });
        return () => { active = false; };
    }, [isMenuMounted]);

    useEffect(() => {
        if (!isMenuMounted) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (cancelMenuItemDrag()) return;
                setMenuState('closing');
            }
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [cancelMenuItemDrag, isMenuMounted]);

    useEffect(() => {
        if (menuState !== 'opening') return;

        const frame = window.requestAnimationFrame(() => {
            setMenuState('open');
        });

        return () => window.cancelAnimationFrame(frame);
    }, [menuState]);

    useEffect(() => {
        if (menuState !== 'closing') return;

        const timeout = window.setTimeout(() => {
            setMenuState('closed');
        }, 320);

        return () => window.clearTimeout(timeout);
    }, [menuState]);

    useEffect(() => {
        if (menuState === 'closed' || menuState === 'open') {
            setDragOffsetX(0);
            setIsDraggingMenu(false);
            touchStateRef.current = {
                startX: 0,
                startY: 0,
                dragging: false,
                tracking: false,
            };
        }
    }, [menuState]);

    useEffect(() => {
        if (menuState === 'closing' || menuState === 'closed') {
            setIsEditingMenu(false);
            setMenuAnnouncement('');
        }
    }, [menuState]);

    useEffect(() => {
        if (!isMenuMounted || !shellRef.current || typeof ResizeObserver === 'undefined') return;

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            const { width, height } = entry.contentRect;
            setShellMetrics(current =>
                current.width === width && current.height === height ? current : { width, height }
            );
        });

        observer.observe(shellRef.current);
        return () => observer.disconnect();
    }, [isMenuMounted]);

    useEffect(() => {
        if (!isMenuMounted) {
            setHasMoreNavContent(false);
            return;
        }

        updateNavScrollIndicator();
        const frame = window.requestAnimationFrame(updateNavScrollIndicator);
        window.addEventListener('resize', updateNavScrollIndicator);

        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener('resize', updateNavScrollIndicator);
        };
    }, [
        displayedMenuOrder,
        isAdmin,
        isEditingMenu,
        isMenuMounted,
        shellMetrics.height,
        updateNavScrollIndicator
    ]);

    useEffect(() => {
        if (!isEditingMenu) return;

        setDragOffsetX(0);
        setIsDraggingMenu(false);
        touchStateRef.current = {
            startX: 0,
            startY: 0,
            dragging: false,
            tracking: false,
        };
    }, [isEditingMenu]);

    const openMenu = () => {
        setMenuState(current => (current === 'open' || current === 'opening' ? current : 'opening'));
    };

    const closeMenu = () => {
        cancelMenuItemDrag();
        setIsEditingMenu(false);
        setMenuState(current => (current === 'closed' ? current : 'closing'));
    };

    const handleNav = (tab: ActiveTab) => {
        onTabChange(tab);
        closeMenu();
    };

    const handleSignOut = async () => {
        try {
            await signOut();
        } finally {
            closeMenu();
        }
    };

    const handleMenuTouchStart = (event: React.TouchEvent<HTMLElement>) => {
        if (
            isEditingMenu
            || (event.target as HTMLElement).closest('[data-menu-drag-handle]')
        ) return;
        if (event.touches.length !== 1 || menuState !== 'open') return;

        const touch = event.touches[0];
        touchStateRef.current = {
            startX: touch.clientX,
            startY: touch.clientY,
            dragging: false,
            tracking: true,
        };
    };

    const handleMenuTouchMove = (event: React.TouchEvent<HTMLElement>) => {
        if (isEditingMenu) return;
        if (!touchStateRef.current.tracking || event.touches.length !== 1 || menuState !== 'open') return;

        const touch = event.touches[0];
        const deltaX = touch.clientX - touchStateRef.current.startX;
        const deltaY = touch.clientY - touchStateRef.current.startY;

        if (!touchStateRef.current.dragging) {
            if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) return;

            if (Math.abs(deltaY) > Math.abs(deltaX) * 1.15) {
                touchStateRef.current.tracking = false;
                return;
            }

            if (deltaX < 0) {
                touchStateRef.current.dragging = true;
                setIsDraggingMenu(true);
            } else {
                touchStateRef.current.tracking = false;
                return;
            }
        }

        event.preventDefault();
        setDragOffsetX(Math.max(deltaX, -MAX_SWIPE_TRANSLATE));
    };

    const handleMenuTouchEnd = () => {
        if (isEditingMenu) return;
        if (!touchStateRef.current.dragging) {
            touchStateRef.current = {
                startX: 0,
                startY: 0,
                dragging: false,
                tracking: false,
            };
            return;
        }

        const shouldClose = dragOffsetX <= -SWIPE_CLOSE_THRESHOLD;

        touchStateRef.current = {
            startX: 0,
            startY: 0,
            dragging: false,
            tracking: false,
        };

        setIsDraggingMenu(false);

        if (shouldClose) {
            closeMenu();
            return;
        }

        setDragOffsetX(0);
    };

    const userName = companyInfo?.empresa?.trim() || user?.email?.split('@')[0] || 'Usuário';
    const initials = userName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'U';
    const companyLogo = companyInfo?.logo || undefined;
    // Medidas fixas na grade de 4 px: linhas de 48 px (alvo de toque confortável),
    // 2 px entre linhas e 12 px de margem lateral.
    const sidebarStyle = {
        width: 'min(calc(100vw - 10px), 392px)',
        minWidth: 'min(calc(100vw - 8px), 304px)',
        maxWidth: '392px',
        height: '100dvh',
        maxHeight: '100dvh',
        transform: menuState === 'open' ? `translateX(${dragOffsetX}px)` : undefined,
        touchAction: 'pan-y',
    } as React.CSSProperties;

    const waItems: NavItem[] = isWaConnectorEnabled()
        ? [{ tabId: 'wa_connector', icon: MessageCircle, label: 'WhatsApp', hint: 'capturar contato como cliente', badge: 'Local' }]
        : [];
    const adminItems: NavItem[] = isAdmin
        ? [{ tabId: 'admin', icon: ShieldUser, label: 'Admin', hint: 'gestao da equipe e acessos' }]
        : [];

    const orderedPrimaryItems = displayedMenuOrder
        .map(tabId => PRIMARY_NAV_BY_TAB.get(tabId))
        .filter((item): item is NavItem => Boolean(item));

    const navSections = [
        { id: 'menu', label: 'Navegação', items: [...orderedPrimaryItems, ...waItems] },
        { id: 'sistema', label: 'Sistema', items: [...adminItems, ...SECTION_SISTEMA] },
    ];

    const handleMoveMenuItem = (tabId: MenuTabId, direction: -1 | 1) => {
        const nextOrder = moveMenuItem(displayedMenuOrder, tabId, direction);
        const nextPosition = nextOrder.indexOf(tabId) + 1;
        const itemLabel = PRIMARY_NAV_BY_TAB.get(tabId)?.label ?? 'Item';

        onMenuOrderChange(nextOrder);
        setMenuAnnouncement(`${itemLabel}: posição ${nextPosition} de ${nextOrder.length}.`);
    };

    const handleResetMenuOrder = () => {
        cancelMenuItemDrag();
        onResetMenuOrder();
        setMenuAnnouncement('Ordem padrão restaurada. Dashboard é a tela inicial.');
    };

    const renderEditableNavItem = (item: NavItem, index: number) => {
        const tabId = item.tabId as MenuTabId;
        const isFirst = index === 0;
        const isLast = index === orderedPrimaryItems.length - 1;

        return (
            <div
                key={item.tabId}
                ref={node => registerMenuRow(tabId, node)}
                className={[
                    'flex h-14 w-full items-center gap-2 rounded-xl border bg-[var(--surface)] pl-1 pr-2 transition-[transform,box-shadow,border-color] duration-150 dark:bg-white/[0.03]',
                    draggingTabId === tabId
                        ? 'relative z-20 scale-[1.015] border-[var(--brand-primary)] shadow-[0_8px_24px_rgba(15,23,42,0.14)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.4)]'
                        : HAIRLINE
                ].join(' ')}
                data-menu-tab={item.tabId}
                data-menu-dragging={draggingTabId === tabId ? 'true' : undefined}
            >
                <button
                    type="button"
                    data-menu-drag-handle
                    aria-label={`Puxador de ${item.label}. Arraste ou use as setas para mudar a posição.`}
                    onPointerDown={event => handleMenuItemPointerDown(event, tabId)}
                    onPointerMove={handleMenuItemPointerMove}
                    onPointerUp={handleMenuItemPointerUp}
                    onPointerCancel={handleMenuItemPointerCancel}
                    onTouchStart={event => event.stopPropagation()}
                    onKeyDown={event => {
                        if (event.key === 'ArrowUp' && !isFirst) {
                            event.preventDefault();
                            handleMoveMenuItem(tabId, -1);
                        } else if (event.key === 'ArrowDown' && !isLast) {
                            event.preventDefault();
                            handleMoveMenuItem(tabId, 1);
                        }
                    }}
                    className="flex h-11 w-10 touch-none flex-shrink-0 cursor-grab items-center justify-center rounded-lg text-[var(--text-soft)] transition-colors active:cursor-grabbing active:bg-slate-100 active:text-[var(--text-body)] dark:active:bg-white/[0.06]"
                >
                    <GripVertical className="h-4 w-4" strokeWidth={ICON_STROKE} aria-hidden="true" />
                </button>
                <item.icon className="h-[18px] w-[18px] flex-shrink-0 text-[var(--text-muted)]" strokeWidth={ICON_STROKE} aria-hidden="true" />
                <div className="ml-1 min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium leading-5 text-[var(--text-strong)]">
                        {item.label}
                    </p>
                    {isFirst ? (
                        <p className="text-xs leading-4 text-[var(--brand-primary)]">
                            Tela inicial
                        </p>
                    ) : null}
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                    <button
                        type="button"
                        onClick={() => handleMoveMenuItem(tabId, -1)}
                        disabled={isFirst}
                        aria-label={`Mover ${item.label} para cima, posição ${index + 1} de ${orderedPrimaryItems.length}`}
                        className={`flex h-10 w-10 items-center justify-center rounded-[10px] border ${HAIRLINE} text-[var(--text-body)] transition-[background-color,transform] duration-150 active:scale-95 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 dark:active:bg-white/[0.06]`}
                    >
                        <ChevronUp className="h-[18px] w-[18px]" strokeWidth={ICON_STROKE} aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        onClick={() => handleMoveMenuItem(tabId, 1)}
                        disabled={isLast}
                        aria-label={`Mover ${item.label} para baixo, posição ${index + 1} de ${orderedPrimaryItems.length}`}
                        className={`flex h-10 w-10 items-center justify-center rounded-[10px] border ${HAIRLINE} text-[var(--text-body)] transition-[background-color,transform] duration-150 active:scale-95 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 dark:active:bg-white/[0.06]`}
                    >
                        <ChevronDown className="h-[18px] w-[18px]" strokeWidth={ICON_STROKE} aria-hidden="true" />
                    </button>
                </div>
            </div>
        );
    };

    // Uma linha do menu. A tela aberta ganha só um fundo um tom acima e o
    // filete azul à esquerda (a "borda da película"); nada de selos ou bolinhas.
    const rowClass = (isActive: boolean) => [
        'group relative flex h-12 w-full items-center gap-3 rounded-[10px] px-3 text-left transition-[background-color,transform] duration-150 active:scale-[0.99]',
        isActive
            ? 'bg-slate-100 dark:bg-white/[0.07]'
            : 'hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-white/[0.04] dark:active:bg-white/[0.06]',
    ].join(' ');

    const renderNavItem = (item: NavItem, isInitial = false) => {
        const isActive = activeTab === item.tabId;
        const Icon = item.icon;

        return (
            <button
                key={item.tabId}
                type="button"
                data-menu-tab={item.tabId}
                onClick={() => handleNav(item.tabId)}
                aria-current={isActive ? 'page' : undefined}
                className={rowClass(isActive)}
            >
                {isActive ? (
                    <span
                        data-menu-active-marker
                        className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--brand-primary)]"
                        aria-hidden="true"
                    />
                ) : null}
                <Icon
                    className={`h-[18px] w-[18px] flex-shrink-0 transition-colors ${isActive ? 'text-[var(--brand-primary)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-body)]'}`}
                    strokeWidth={ICON_STROKE}
                    aria-hidden="true"
                />
                <span className={`min-w-0 flex-1 truncate text-[15px] font-medium ${isActive ? 'text-[var(--text-strong)]' : 'text-[var(--text-body)]'}`}>
                    {item.label}
                </span>
                {isInitial ? (
                    <span className="flex-shrink-0 text-xs text-[var(--text-muted)]">Inicial</span>
                ) : null}
                {item.badge ? (
                    <span className="flex-shrink-0 text-xs text-[var(--text-muted)]">{item.badge}</span>
                ) : null}
            </button>
        );
    };

    return (
        <>
            <div
                data-app-mobile-header
                className="flex items-center justify-between pt-[env(safe-area-inset-top,0px)] lg:pt-0"
            >
                <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-0.5 rounded-full bg-slate-100 p-0.5 dark:bg-slate-800 lg:hidden">
                        {canGoBack && onGoBack ? (
                            <>
                                <button
                                    type="button"
                                    onClick={onGoBack}
                                    aria-label="Voltar para a tela anterior"
                                    className="relative z-10 flex h-11 w-11 touch-manipulation items-center justify-center rounded-full text-slate-600 transition-all active:scale-95 dark:text-slate-300"
                                >
                                    <i className="fas fa-arrow-left text-sm" />
                                </button>
                                <span className="h-4 w-px bg-slate-300/80 dark:bg-slate-600/80" aria-hidden="true" />
                            </>
                        ) : null}
                        <button
                            type="button"
                            onClick={openMenu}
                            aria-label="Abrir menu"
                            aria-expanded={isMenuMounted}
                            aria-controls="mobile-main-menu"
                            className="relative z-10 flex h-11 w-11 touch-manipulation flex-col items-center justify-center gap-[4px] rounded-full text-slate-600 transition-all active:scale-95 dark:text-slate-300"
                        >
                            <span className="h-[2px] w-[18px] rounded-full bg-slate-600 dark:bg-slate-300" />
                            <span className="ml-[9px] h-[2px] w-[13px] self-start rounded-full bg-slate-600 dark:bg-slate-300" />
                            <span className="h-[2px] w-[18px] rounded-full bg-slate-600 dark:bg-slate-300" />
                        </button>
                    </div>

                    <h1 className="flex items-center text-lg font-bold tracking-tight text-slate-900 dark:text-white lg:hidden">
                        Películas<span className="text-blue-600 dark:text-blue-400">BR</span>
                        <span className="ml-1 -mt-2 rounded-full bg-blue-100 px-1.5 py-px text-[9px] font-bold uppercase leading-none tracking-wide text-blue-600 dark:bg-blue-500/20 dark:text-blue-300">
                            beta
                        </span>
                    </h1>
                    <h2 className="hidden text-lg font-bold tracking-tight text-slate-800 dark:text-slate-100 lg:block">
                        {pageLabels[activeTab] || ''}
                    </h2>
                </div>

                <div className="flex items-center gap-2">
                    {/* No mobile, tema/config/conta saem do topo e ficam no menu lateral. */}
                    <GlobalNotificationBell onNavigate={onTabChange} />
                    <SyncStatusIndicator />
                </div>
            </div>

            {isMenuMounted &&
                ReactDOM.createPortal(
                    <div
                        id="mobile-main-menu"
                        className="fixed inset-0 z-[9999] lg:hidden"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Menu principal"
                    >
                        <div
                            aria-hidden="true"
                            onClick={closeMenu}
                            className={[
                                'absolute inset-0 bg-slate-950/40 transition-opacity duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)]',
                                isMenuVisible ? 'opacity-100' : 'opacity-0',
                            ].join(' ')}
                        />

                        <aside
                            onTouchStart={handleMenuTouchStart}
                            onTouchMove={handleMenuTouchMove}
                            onTouchEnd={handleMenuTouchEnd}
                            onTouchCancel={handleMenuTouchEnd}
                            ref={shellRef}
                            className={[
                                'absolute inset-y-0 left-0 flex h-dvh max-h-dvh flex-col overflow-hidden rounded-r-[20px] bg-[var(--surface)] shadow-[0_16px_40px_rgba(15,23,42,0.18)] will-change-transform dark:shadow-[0_16px_40px_rgba(0,0,0,0.45)]',
                                isDraggingMenu
                                    ? 'transition-none'
                                    : 'transition-transform duration-[440ms] ease-[cubic-bezier(0.32,0.72,0,1)]',
                                isMenuVisible ? 'translate-x-0' : '-translate-x-full',
                            ].join(' ')}
                            style={sidebarStyle}
                        >
                            {/* Cartão da empresa: a única parte com cor própria (o logo do aplicador). */}
                            <div className={`border-b ${HAIRLINE} px-5 pb-4 pt-[calc(max(0.75rem,env(safe-area-inset-top))+1rem)]`}>
                                <div className="flex items-center gap-3">
                                    <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-inset ring-slate-900/[0.08] dark:bg-white/[0.06] dark:ring-white/[0.08]">
                                        {companyLogo ? (
                                            <img
                                                src={companyLogo}
                                                alt="Logo da empresa"
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-base font-semibold text-[var(--text-body)]">
                                                {initials}
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-lg font-semibold leading-6 text-[var(--text-strong)]">
                                            {userName}
                                        </p>
                                        <p className="truncate text-[13px] leading-5 text-[var(--text-muted)]">
                                            {companyInfo?.email || user?.email || ''}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onPointerDown={event => event.stopPropagation()}
                                        onTouchStart={event => event.stopPropagation()}
                                        onClick={event => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            setIsCompanyShareOpen(true);
                                        }}
                                        aria-label="Compartilhar empresa"
                                        title="Compartilhar empresa"
                                        className={`-mr-1 flex h-9 w-9 flex-shrink-0 touch-manipulation items-center justify-center rounded-[10px] border ${HAIRLINE} text-[var(--text-muted)] transition-colors duration-150 active:bg-slate-100 dark:active:bg-white/[0.06]`}
                                    >
                                        <Share2 className="h-4 w-4" strokeWidth={ICON_STROKE} aria-hidden="true" />
                                    </button>
                                </div>
                            </div>

                            <div className="relative min-h-0 flex-1">
                                <div
                                    ref={navScrollRef}
                                    data-menu-scroll-area
                                    onScroll={updateNavScrollIndicator}
                                    className="relative h-full overflow-y-auto px-3 pb-4 pt-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                >
                                    {navSections.map(section => {
                                        const isSistema = section.id === 'sistema';
                                        const isEditingSection = isEditingMenu && section.id === 'menu';
                                        return (
                                            <section
                                                key={section.id}
                                                className={isSistema ? `mt-4 border-t ${HAIRLINE} pt-4` : undefined}
                                            >
                                                <div className="mb-1 flex h-8 items-center justify-between gap-3 pl-3">
                                                    <p className="text-[13px] font-medium text-[var(--text-muted)]">
                                                        {isEditingSection ? 'Organizar menu' : section.label}
                                                    </p>
                                                    {section.id === 'menu' ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (isEditingMenu) cancelMenuItemDrag();
                                                                setIsEditingMenu(current => !current);
                                                            }}
                                                            aria-label={isEditingMenu ? 'Concluir organização do menu' : 'Organizar menu'}
                                                            aria-pressed={isEditingMenu}
                                                            className={`flex h-8 items-center gap-1.5 rounded-lg px-2 transition-colors duration-150 active:bg-slate-100 dark:active:bg-white/[0.06] ${isEditingMenu ? 'text-[var(--brand-primary)]' : 'text-[var(--text-muted)]'}`}
                                                        >
                                                            {isEditingMenu
                                                                ? <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                                                                : <Pencil className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} aria-hidden="true" />}
                                                            <span className="text-[13px] font-medium">{isEditingMenu ? 'Concluir' : 'Organizar'}</span>
                                                        </button>
                                                    ) : null}
                                                </div>
                                                {isEditingSection ? (
                                                    <div className="mb-3 px-3 text-[13px] leading-5 text-[var(--text-muted)]">
                                                        <p>Arraste pelo puxador ou use as setas. O primeiro item será aberto ao iniciar o aplicativo.</p>
                                                        <button
                                                            type="button"
                                                            onClick={handleResetMenuOrder}
                                                            className="-ml-1 mt-1 flex h-8 items-center rounded-lg px-1 text-[var(--brand-primary)] transition-colors duration-150 active:bg-slate-100 dark:active:bg-white/[0.06]"
                                                        >
                                                            <span className="text-[13px] font-medium">Restaurar ordem padrão</span>
                                                        </button>
                                                    </div>
                                                ) : null}
                                                {section.id === 'menu' ? (
                                                    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                                                        {menuAnnouncement}
                                                    </p>
                                                ) : null}
                                                <div className={isEditingSection ? 'space-y-2' : 'space-y-0.5'}>
                                                    {isEditingSection
                                                        ? orderedPrimaryItems.map(renderEditableNavItem)
                                                        : section.items.map(item => renderNavItem(
                                                            item,
                                                            section.id === 'menu' && item.tabId === displayedMenuOrder[0]
                                                        ))}
                                                    {isSistema && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setIsSupportOpen(true);
                                                                closeMenu();
                                                            }}
                                                            className={rowClass(false)}
                                                        >
                                                            <Headset
                                                                className="h-[18px] w-[18px] flex-shrink-0 text-[var(--text-muted)] transition-colors group-hover:text-[var(--text-body)]"
                                                                strokeWidth={ICON_STROKE}
                                                                aria-hidden="true"
                                                            />
                                                            <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-[var(--text-body)]">
                                                                Suporte
                                                            </span>
                                                        </button>
                                                    )}
                                                </div>
                                            </section>
                                        );
                                    })}
                                </div>

                                {hasMoreNavContent ? (
                                    <div
                                        aria-hidden="true"
                                        data-menu-scroll-more
                                        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex h-10 items-end justify-center bg-gradient-to-t from-[var(--surface)] to-transparent pb-1"
                                    >
                                        <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" strokeWidth={ICON_STROKE} />
                                    </div>
                                ) : null}
                            </div>

                            <div className={`relative z-10 border-t ${HAIRLINE} px-3 pb-[calc(max(0.75rem,env(safe-area-inset-bottom))+0.25rem)] pt-2`}>
                                <ThemeToggle variant="sidebar" size="lg" />
                                <button
                                    type="button"
                                    onPointerDown={event => event.stopPropagation()}
                                    onTouchStart={event => event.stopPropagation()}
                                    onClick={event => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        void handleSignOut();
                                    }}
                                    className={`relative z-10 mt-0.5 ${rowClass(false)}`}
                                >
                                    <LogOut
                                        className="h-[18px] w-[18px] flex-shrink-0 text-[var(--text-muted)] transition-colors group-hover:text-[var(--text-body)]"
                                        strokeWidth={ICON_STROKE}
                                        aria-hidden="true"
                                    />
                                    <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-[var(--text-body)]">
                                        Sair da conta
                                    </span>
                                </button>

                                <p className="mt-2 text-center text-xs text-[var(--text-muted)]">
                                    PelículasBR · beta
                                </p>
                            </div>
                        </aside>
                    </div>,
                    document.body
                )}

            <SupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />
            <CompanyShareSheet
                isOpen={isCompanyShareOpen}
                onClose={() => setIsCompanyShareOpen(false)}
                companyInfo={companyInfo}
                fallbackName={userName}
                fallbackEmail={user?.email || ''}
            />
        </>
    );
};

export default React.memo(Header);
