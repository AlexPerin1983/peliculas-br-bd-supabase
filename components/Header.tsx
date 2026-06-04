import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import SyncStatusIndicator from './SyncStatusIndicator';
import ThemeToggle from './ui/ThemeToggle';

type ActiveTab =
    | 'dashboard'
    | 'client'
    | 'films'
    | 'settings'
    | 'history'
    | 'agenda'
    | 'sales'
    | 'admin'
    | 'account'
    | 'estoque'
    | 'qr_code'
    | 'fornecedores';

interface HeaderProps {
    activeTab: ActiveTab;
    onTabChange: (tab: ActiveTab) => void;
    onGoBack?: () => void;
    canGoBack?: boolean;
}

interface NavItem {
    tabId: ActiveTab;
    icon: string;
    label: string;
    hint: string;
}

const MAIN_NAV: NavItem[] = [
    { tabId: 'dashboard', icon: 'fas fa-chart-line', label: 'Dashboard', hint: 'visao geral do negocio' },
    { tabId: 'client', icon: 'fas fa-user-friends', label: 'Clientes', hint: 'cadastro e propostas' },
    { tabId: 'films', icon: 'fas fa-layer-group', label: 'Películas', hint: 'catálogo e seleção' },
    { tabId: 'estoque', icon: 'fas fa-boxes', label: 'Estoque', hint: 'bobinas, retalhos e status' },
    { tabId: 'qr_code', icon: 'fas fa-qrcode', label: 'QR Code', hint: 'rótulos e leitura rápida' },
    { tabId: 'agenda', icon: 'fas fa-calendar-alt', label: 'Agenda', hint: 'visitas, prazos e tarefas' },
    { tabId: 'history', icon: 'fas fa-history', label: 'Histórico', hint: 'registros, PDFs e consultas' },
    { tabId: 'fornecedores', icon: 'fas fa-truck', label: 'Fornecedores', hint: 'compras, contatos e apoio' },
];

const SYSTEM_NAV: NavItem[] = [
    { tabId: 'settings', icon: 'fas fa-cog', label: 'Configurações', hint: 'preferências e ajustes do app' },
    { tabId: 'account', icon: 'fas fa-user-circle', label: 'Minha Conta', hint: 'perfil, acesso e segurança' },
];

const pageLabels: Record<string, string> = {
    dashboard: 'Dashboard',
    client: 'Clientes',
    films: 'Películas',
    estoque: 'Estoque',
    qr_code: 'QR Code',
    agenda: 'Agenda',
    history: 'Histórico',
    fornecedores: 'Fornecedores',
    admin: 'Admin',
    settings: 'Configurações',
    account: 'Minha Conta',
};

type MenuRenderState = 'closed' | 'opening' | 'open' | 'closing';
const SWIPE_CLOSE_THRESHOLD = 72;
const MAX_SWIPE_TRANSLATE = 240;

const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange, onGoBack, canGoBack = false }) => {
    const { isAdmin, user, signOut } = useAuth();
    const [menuState, setMenuState] = useState<MenuRenderState>('closed');
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

    const isMenuMounted = menuState !== 'closed';
    const isMenuVisible = menuState === 'open';

    useEffect(() => {
        document.body.style.overflow = isMenuMounted ? 'hidden' : '';
        return () => {
            document.body.style.overflow = '';
        };
    }, [isMenuMounted]);

    useEffect(() => {
        if (!isMenuMounted) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setMenuState('closing');
            }
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isMenuMounted]);

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

    const openMenu = () => {
        setMenuState(current => (current === 'open' || current === 'opening' ? current : 'opening'));
    };

    const closeMenu = () => {
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

    const initials = (user?.email || 'U').split('@')[0].slice(0, 2).toUpperCase();
    const userName = user?.email?.split('@')[0] || 'Usuário';
    const shellWidth = shellMetrics.width;
    const measuredShellHeight = shellMetrics.height;
    const shellProgress = Math.max(0, Math.min(1, (shellWidth - 320) / 68));
    const interpolate = (min: number, max: number) => min + (max - min) * shellProgress;
    const isCompactShell = shellWidth < 348;
    const isShortShell = measuredShellHeight > 0 && measuredShellHeight < 760;
    const handleButtonSize = interpolate(30, 34);
    const handleButtonStyle = {
        width: `${handleButtonSize.toFixed(1)}px`,
        height: `${handleButtonSize.toFixed(1)}px`,
        right: `${(-handleButtonSize * 0.38).toFixed(1)}px`,
        top: `${interpolate(isCompactShell ? 92 : 96, 108).toFixed(1)}px`,
    } as React.CSSProperties;
    const fluidSidebarStyle = {
        width: 'min(calc(100vw - 10px), 392px)',
        minWidth: 'min(calc(100vw - 8px), 304px)',
        maxWidth: '392px',
        height: '100dvh',
        maxHeight: '100dvh',
        transform: menuState === 'open' ? `translateX(${dragOffsetX}px)` : undefined,
        touchAction: 'pan-y',
        ['--sidebar-shell-gap' as '--sidebar-shell-gap']: '0px',
        ['--sidebar-header-safe' as '--sidebar-header-safe']: '0px',
        ['--sidebar-content-radius' as '--sidebar-content-radius']: `${Math.round(interpolate(20, 24))}px`,
        ['--sidebar-safe-top' as '--sidebar-safe-top']: 'max(0.75rem, env(safe-area-inset-top))',
        ['--sidebar-safe-bottom' as '--sidebar-safe-bottom']: 'max(0.75rem, env(safe-area-inset-bottom))',
        ['--sidebar-pad-x' as '--sidebar-pad-x']: `${Math.round(interpolate(14, 18))}px`,
        ['--sidebar-pad-top' as '--sidebar-pad-top']: `${Math.round(interpolate(15, 21))}px`,
        ['--sidebar-pad-bottom' as '--sidebar-pad-bottom']: `${Math.round(interpolate(14, 18))}px`,
        ['--sidebar-avatar' as '--sidebar-avatar']: `${Math.round(interpolate(isCompactShell ? 44 : 47, 56))}px`,
        ['--sidebar-avatar-font' as '--sidebar-avatar-font']: `${interpolate(0.86, 0.95).toFixed(3)}rem`,
        ['--sidebar-title' as '--sidebar-title']: `${interpolate(isCompactShell ? 1.22 : 1.34, 1.58).toFixed(3)}rem`,
        ['--sidebar-email' as '--sidebar-email']: `${interpolate(0.75, 0.83).toFixed(3)}rem`,
        ['--sidebar-gap' as '--sidebar-gap']: `${interpolate(10, 13)}px`,
        ['--sidebar-item-gap' as '--sidebar-item-gap']: `${interpolate(11, 14)}px`,
        ['--sidebar-item-px' as '--sidebar-item-px']: `${interpolate(12, 15)}px`,
        ['--sidebar-item-py' as '--sidebar-item-py']: `${interpolate(isShortShell ? 9.8 : 10.6, 12.2)}px`,
        ['--sidebar-item-font' as '--sidebar-item-font']: `${interpolate(0.9, 0.95).toFixed(3)}rem`,
        ['--sidebar-icon-box' as '--sidebar-icon-box']: `${Math.round(interpolate(29, 34))}px`,
        ['--sidebar-icon-size' as '--sidebar-icon-size']: `${interpolate(0.87, 0.97).toFixed(3)}rem`,
        ['--sidebar-footer-icon' as '--sidebar-footer-icon']: `${Math.round(interpolate(29, 34))}px`,
        ['--sidebar-nav-top' as '--sidebar-nav-top']: `${Math.round(interpolate(isShortShell ? 15 : 17, 20))}px`,
        ['--sidebar-section-top' as '--sidebar-section-top']: `${Math.round(interpolate(15, 18))}px`,
        ['--sidebar-chevron' as '--sidebar-chevron']: `${interpolate(0.78, 0.88).toFixed(3)}rem`,
    } as React.CSSProperties;

    const allNavItems = [
        ...MAIN_NAV,
        ...(isAdmin
            ? [{ tabId: 'admin' as ActiveTab, icon: 'fas fa-user-shield', label: 'Admin', hint: 'gestao da equipe e acessos' }]
            : []),
    ];

    const renderNavItem = (item: NavItem, tone: 'primary' | 'system') => {
        const isActive = activeTab === item.tabId;

        return (
            <button
                key={item.tabId}
                onClick={() => handleNav(item.tabId)}
                className={[
                    'group relative flex w-full items-center gap-[var(--sidebar-item-gap)] px-[var(--sidebar-item-px)] py-[var(--sidebar-item-py)] text-left transition-all duration-200 active:scale-[0.985]',
                    tone === 'primary' ? 'rounded-[18px]' : 'rounded-2xl',
                    isActive
                        ? isCompactShell
                            ? 'bg-blue-50/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:bg-white/[0.055] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
                            : 'bg-blue-50/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:bg-white/[0.075] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                        : 'bg-transparent hover:bg-slate-100/80 dark:hover:bg-white/[0.03]',
                ].join(' ')}
            >
                <div className="flex h-[var(--sidebar-icon-box)] w-[var(--sidebar-icon-box)] flex-shrink-0 items-center justify-center">
                    <i className={`${item.icon} text-[var(--sidebar-icon-size)] ${isActive ? 'text-blue-600 dark:text-cyan-300' : 'text-blue-500/85 group-hover:text-blue-700 dark:text-cyan-300/85 dark:group-hover:text-cyan-200'}`} />
                </div>

                <div className="min-w-0 flex-1">
                    <p className={`truncate text-[var(--sidebar-item-font)] font-medium tracking-[0.005em] ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-700 group-hover:text-slate-900 dark:text-white/88 dark:group-hover:text-white'}`}>
                        {item.label}
                    </p>
                </div>

                {isActive ? <span className="h-2 w-2 rounded-full bg-blue-500 dark:bg-cyan-300/90" /> : null}
            </button>
        );
    };

    return (
        <>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {canGoBack && onGoBack ? (
                        <button
                            onClick={onGoBack}
                            aria-label="Voltar para a tela anterior"
                            className="lg:hidden flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200/70 bg-white/80 text-slate-700 shadow-sm shadow-slate-200/60 transition-all duration-200 hover:border-slate-300 hover:bg-white active:scale-95 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200 dark:shadow-black/20"
                        >
                            <i className="fas fa-arrow-left text-base" />
                        </button>
                    ) : null}
                    <button
                        onClick={openMenu}
                        aria-label="Abrir menu"
                        aria-expanded={isMenuMounted}
                        aria-controls="mobile-main-menu"
                        className="lg:hidden flex h-10 w-10 flex-col items-center justify-center gap-[5px] rounded-2xl border border-slate-200/70 bg-white/80 text-slate-700 shadow-sm shadow-slate-200/60 transition-all duration-200 hover:border-slate-300 hover:bg-white active:scale-95 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200 dark:shadow-black/20"
                    >
                        <span className="h-[2px] w-5 rounded-full bg-slate-700 dark:bg-slate-200" />
                        <span className="ml-2 h-[2px] w-3.5 self-start rounded-full bg-slate-700 dark:bg-slate-200" />
                        <span className="h-[2px] w-5 rounded-full bg-slate-700 dark:bg-slate-200" />
                    </button>

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
                    <div className="flex items-center gap-0.5 rounded-full bg-slate-100 p-0.5 dark:bg-slate-800 lg:hidden">
                        <ThemeToggle variant="header" />
                        <button
                            onClick={() => handleNav('settings')}
                            aria-label="Configurações"
                            className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${activeTab === 'settings' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}
                        >
                            <i className="fas fa-cog text-base" />
                        </button>
                        <button
                            onClick={() => handleNav('account')}
                            aria-label="Minha Conta"
                            className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${activeTab === 'account' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}
                        >
                            <i className="fas fa-user-circle text-base" />
                        </button>
                    </div>
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
                                'absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.14),rgba(15,23,42,0.36))] dark:bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_38%),linear-gradient(180deg,rgba(2,6,23,0.72),rgba(2,6,23,0.9))] backdrop-blur-[6px] transition-opacity duration-300 ease-out',
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
                                'absolute inset-y-0 left-0 flex h-dvh max-h-dvh flex-col overflow-visible rounded-r-[var(--sidebar-content-radius)] border-r border-slate-200/80 bg-white/96 shadow-[0_18px_40px_rgba(15,23,42,0.16)] will-change-transform dark:border-slate-700/80 dark:bg-[#23314d]/98 dark:shadow-[0_20px_42px_rgba(2,6,23,0.34)]',
                                isDraggingMenu
                                    ? 'transition-none'
                                    : 'transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                                isMenuVisible ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-90',
                            ].join(' ')}
                            style={fluidSidebarStyle}
                        >
                            <button
                                onClick={closeMenu}
                                className="absolute z-10 flex items-center justify-center rounded-full border border-slate-200/85 bg-white/96 text-blue-600 shadow-[0_10px_24px_rgba(15,23,42,0.16)] transition-transform duration-200 hover:scale-105 dark:border-slate-700/80 dark:bg-slate-900/96 dark:text-cyan-300 dark:shadow-[0_12px_26px_rgba(2,6,23,0.34)]"
                                style={handleButtonStyle}
                                aria-label="Recolher menu"
                            >
                                <i className="fas fa-chevron-left text-[var(--sidebar-chevron)]" />
                            </button>

                            <div className="relative flex h-full flex-col overflow-hidden rounded-r-[var(--sidebar-content-radius)]">
                                <div className="absolute inset-x-0 top-0 h-full bg-[linear-gradient(180deg,rgba(59,130,246,0.08),transparent_52%)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_52%)]" />

                                <div className="relative overflow-visible px-[var(--sidebar-pad-x)] pb-[var(--sidebar-pad-bottom)] pt-[calc(var(--sidebar-pad-top)+var(--sidebar-safe-top))]">
                                    <div className="absolute left-0 right-0 bottom-0 h-px bg-slate-200/80 dark:bg-cyan-300/20" />

                                    <div className="relative">
                                        <div className="grid grid-cols-[var(--sidebar-avatar)_minmax(0,1fr)] items-center gap-x-[var(--sidebar-gap)] gap-y-1">
                                            <div className="row-span-2 h-[var(--sidebar-avatar)] w-[var(--sidebar-avatar)] overflow-hidden rounded-full border-[3px] border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.12)] dark:border-white/90 dark:bg-white/10 dark:shadow-[0_8px_24px_rgba(15,23,42,0.16)]">
                                                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-[var(--sidebar-avatar-font)] font-bold text-slate-700 dark:from-slate-200 dark:to-slate-300">
                                                    {initials}
                                                </div>
                                            </div>
                                            <p className="min-w-0 truncate text-[var(--sidebar-title)] font-semibold leading-[0.96] tracking-[-0.03em] text-slate-900 dark:text-white">
                                                {userName}
                                            </p>
                                            <p className="min-w-0 truncate text-[var(--sidebar-email)] text-blue-600/90 dark:text-cyan-200/95">
                                                {user?.email || ''}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div
                                    className="relative flex-1 overflow-y-auto px-[calc(var(--sidebar-pad-x)-0.08rem)] py-[var(--sidebar-nav-top)] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                >
                                    <section className="relative mb-[var(--sidebar-section-top)]">
                                        <div className="space-y-1.5">
                                            {allNavItems.map(item => renderNavItem(item, 'primary'))}
                                        </div>
                                    </section>

                                    <section className="relative border-t border-slate-200/80 pt-[var(--sidebar-section-top)] dark:border-cyan-300/18">
                                        <div className="space-y-1">
                                            {SYSTEM_NAV.map(item => renderNavItem(item, 'system'))}
                                        </div>
                                    </section>
                                </div>

                                <div className="relative z-10 border-t border-slate-200/80 px-[calc(var(--sidebar-pad-x)-0.08rem)] pb-[calc(var(--sidebar-pad-bottom)+var(--sidebar-safe-bottom))] pt-[var(--sidebar-pad-bottom)] dark:border-cyan-300/16">
                                    <button
                                        type="button"
                                        onPointerDown={event => event.stopPropagation()}
                                        onTouchStart={event => event.stopPropagation()}
                                        onClick={event => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            void handleSignOut();
                                        }}
                                        className="relative z-10 flex w-full items-center gap-[var(--sidebar-item-gap)] rounded-2xl px-[var(--sidebar-item-px)] py-[var(--sidebar-item-py)] text-left transition-all duration-200 hover:bg-slate-100/80 active:scale-[0.985] dark:hover:bg-white/[0.03]"
                                    >
                                        <div className="flex h-[var(--sidebar-footer-icon)] w-[var(--sidebar-footer-icon)] items-center justify-center text-blue-600 dark:text-cyan-300">
                                            <i className="fas fa-sign-out-alt text-[var(--sidebar-icon-size)]" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-[var(--sidebar-item-font)] font-medium text-slate-700 dark:text-white/92">
                                                Sair da conta
                                            </p>
                                        </div>
                                    </button>

                                    <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                                        <span>PelículasBR</span>
                                        <span className="rounded-full bg-blue-100 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-blue-600 dark:bg-blue-500/20 dark:text-blue-300">
                                            beta
                                        </span>
                                        <span>v0.1.0</span>
                                    </div>
                                </div>
                            </div>
                        </aside>
                    </div>,
                    document.body
                )}
        </>
    );
};

export default React.memo(Header);
