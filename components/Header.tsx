import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import SyncStatusIndicator from './SyncStatusIndicator';
import ThemeToggle from './ui/ThemeToggle';
import SupportModal from './modals/SupportModal';
import { isWaConnectorEnabled } from '../src/lib/waConnector';
import * as db from '../services/db';
import GlobalNotificationBell from './GlobalNotificationBell';

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
    | 'assistentes'
    | 'wa_connector';

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
    badge?: string;
}

interface NavSection {
    id: string;
    label: string;
    items: NavItem[];
}

// Menu agrupado por seções (Geral / Vendas / Operação / Sistema) para uma
// leitura mais profissional no mobile. Admin e WhatsApp local entram em runtime.
const SECTION_GERAL: NavItem[] = [
    { tabId: 'dashboard', icon: 'fas fa-chart-line', label: 'Dashboard', hint: 'visao geral do negocio' },
    { tabId: 'assistentes', icon: 'fas fa-robot', label: 'Assistentes', hint: 'IA para o seu negocio', badge: 'Beta' },
];

const SECTION_VENDAS: NavItem[] = [
    { tabId: 'clients_list', icon: 'fas fa-user-friends', label: 'Clientes', hint: 'cadastro e histórico' },
    { tabId: 'client', icon: 'fas fa-file-invoice-dollar', label: 'Orçamento', hint: 'montar e enviar' },
    { tabId: 'proposals', icon: 'fas fa-comments', label: 'Propostas', hint: 'respostas e negociações' },
    { tabId: 'history', icon: 'fas fa-history', label: 'Histórico', hint: 'registros, PDFs e consultas' },
    { tabId: 'films', icon: 'fas fa-layer-group', label: 'Películas', hint: 'catálogo e seleção' },
];

const SECTION_OPERACAO: NavItem[] = [
    { tabId: 'agenda', icon: 'fas fa-calendar-alt', label: 'Agenda', hint: 'visitas, prazos e tarefas' },
    { tabId: 'estoque', icon: 'fas fa-boxes', label: 'Estoque', hint: 'bobinas, retalhos e status' },
    { tabId: 'qr_code', icon: 'fas fa-qrcode', label: 'QR Code', hint: 'rótulos e leitura rápida' },
    { tabId: 'fornecedores', icon: 'fas fa-truck', label: 'Fornecedores', hint: 'compras, contatos e apoio' },
];

const SECTION_SISTEMA: NavItem[] = [
    { tabId: 'settings', icon: 'fas fa-cog', label: 'Configurações', hint: 'preferências e ajustes do app' },
    { tabId: 'account', icon: 'fas fa-user-circle', label: 'Minha Conta', hint: 'perfil, acesso e segurança' },
];

const pageLabels: Record<string, string> = {
    dashboard: 'Dashboard',
    assistentes: 'Assistentes',
    clients_list: 'Clientes',
    client: 'Orçamento',
    cliente_hub: 'Ficha do cliente',
    films: 'Películas',
    estoque: 'Estoque',
    qr_code: 'QR Code',
    agenda: 'Agenda',
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

const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange, onGoBack, canGoBack = false }) => {
    const { isAdmin, user, signOut } = useAuth();
    const [menuState, setMenuState] = useState<MenuRenderState>('closed');
    const [isSupportOpen, setIsSupportOpen] = useState(false);
    const [companyLogo, setCompanyLogo] = useState<string | undefined>(undefined);
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

    // Carrega a logo da empresa ao abrir o menu (avatar usa logo, com fallback nas iniciais).
    useEffect(() => {
        if (!isMenuMounted) return;
        let active = true;
        db.getUserInfo()
            .then(info => { if (active) setCompanyLogo(info?.logo || undefined); })
            .catch(() => { /* sem logo: mantem as iniciais */ });
        return () => { active = false; };
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

    const waItems: NavItem[] = isWaConnectorEnabled()
        ? [{ tabId: 'wa_connector', icon: 'fab fa-whatsapp', label: 'WhatsApp', hint: 'capturar contato como cliente', badge: 'Local' }]
        : [];
    const adminItems: NavItem[] = isAdmin
        ? [{ tabId: 'admin', icon: 'fas fa-user-shield', label: 'Admin', hint: 'gestao da equipe e acessos' }]
        : [];

    const navSections: NavSection[] = [
        { id: 'geral', label: 'Geral', items: SECTION_GERAL },
        { id: 'vendas', label: 'Vendas', items: SECTION_VENDAS },
        { id: 'operacao', label: 'Operação', items: [...SECTION_OPERACAO, ...waItems] },
        { id: 'sistema', label: 'Sistema', items: [...adminItems, ...SECTION_SISTEMA] },
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

                {item.badge ? (
                    <span className="rounded-full bg-blue-100 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-blue-600 dark:bg-blue-500/20 dark:text-blue-300">
                        {item.badge}
                    </span>
                ) : isActive ? (
                    <span className="h-2 w-2 rounded-full bg-blue-500 dark:bg-cyan-300/90" />
                ) : null}
            </button>
        );
    };

    return (
        <>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-0.5 rounded-full bg-slate-100 p-0.5 dark:bg-slate-800 lg:hidden">
                        {canGoBack && onGoBack ? (
                            <>
                                <button
                                    onClick={onGoBack}
                                    aria-label="Voltar para a tela anterior"
                                    className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition-all active:scale-95 dark:text-slate-300"
                                >
                                    <i className="fas fa-arrow-left text-sm" />
                                </button>
                                <span className="h-4 w-px bg-slate-300/80 dark:bg-slate-600/80" aria-hidden="true" />
                            </>
                        ) : null}
                        <button
                            onClick={openMenu}
                            aria-label="Abrir menu"
                            aria-expanded={isMenuMounted}
                            aria-controls="mobile-main-menu"
                            className="flex h-9 w-9 flex-col items-center justify-center gap-[4px] rounded-full text-slate-600 transition-all active:scale-95 dark:text-slate-300"
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
                                'absolute inset-0 bg-slate-950/45 backdrop-blur-[2px] transition-opacity duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)]',
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
                                'absolute inset-y-0 left-0 flex h-dvh max-h-dvh flex-col overflow-hidden rounded-r-[var(--sidebar-content-radius)] border-r border-slate-200/80 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.16)] will-change-transform dark:border-slate-700/80 dark:bg-[#23314d] dark:shadow-[0_20px_42px_rgba(2,6,23,0.34)]',
                                isDraggingMenu
                                    ? 'transition-none'
                                    : 'transition-transform duration-[440ms] ease-[cubic-bezier(0.32,0.72,0,1)]',
                                isMenuVisible ? 'translate-x-0' : '-translate-x-full',
                            ].join(' ')}
                            style={fluidSidebarStyle}
                        >
                            <div className="relative flex h-full flex-col overflow-hidden rounded-r-[var(--sidebar-content-radius)]">
                                <div className="absolute inset-x-0 top-0 h-full bg-[linear-gradient(180deg,rgba(59,130,246,0.08),transparent_52%)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_52%)]" />

                                <div className="relative overflow-visible px-[var(--sidebar-pad-x)] pb-[var(--sidebar-pad-bottom)] pt-[calc(var(--sidebar-pad-top)+var(--sidebar-safe-top))]">
                                    <div className="absolute left-0 right-0 bottom-0 h-px bg-slate-200/80 dark:bg-cyan-300/20" />

                                    <div className="relative">
                                        <div className="grid grid-cols-[var(--sidebar-avatar)_minmax(0,1fr)] items-center gap-x-[var(--sidebar-gap)] gap-y-1">
                                            <div className="row-span-2 h-[var(--sidebar-avatar)] w-[var(--sidebar-avatar)] overflow-hidden rounded-full border-[3px] border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.12)] dark:border-white/90 dark:bg-white/10 dark:shadow-[0_8px_24px_rgba(15,23,42,0.16)]">
                                                {companyLogo ? (
                                                    <img
                                                        src={companyLogo}
                                                        alt="Logo da empresa"
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-[var(--sidebar-avatar-font)] font-bold text-slate-700 dark:from-slate-200 dark:to-slate-300">
                                                        {initials}
                                                    </div>
                                                )}
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
                                    {navSections.map((section, index) => {
                                        const isSistema = section.id === 'sistema';
                                        return (
                                            <section
                                                key={section.id}
                                                className={[
                                                    'relative',
                                                    index === 0 ? '' : 'mt-[var(--sidebar-section-top)]',
                                                    isSistema ? 'border-t border-slate-200/80 pt-[var(--sidebar-section-top)] dark:border-cyan-300/18' : '',
                                                ].filter(Boolean).join(' ')}
                                            >
                                                <p className="mb-1.5 px-[var(--sidebar-item-px)] text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                                                    {section.label}
                                                </p>
                                                <div className="space-y-1">
                                                    {section.items.map(item => renderNavItem(item, isSistema ? 'system' : 'primary'))}
                                                    {isSistema && (
                                                        <button
                                                            onClick={() => {
                                                                setIsSupportOpen(true);
                                                                closeMenu();
                                                            }}
                                                            className="group relative flex w-full items-center gap-[var(--sidebar-item-gap)] rounded-2xl px-[var(--sidebar-item-px)] py-[var(--sidebar-item-py)] text-left transition-all duration-200 hover:bg-slate-100/80 active:scale-[0.985] dark:hover:bg-white/[0.03]"
                                                        >
                                                            <div className="flex h-[var(--sidebar-icon-box)] w-[var(--sidebar-icon-box)] flex-shrink-0 items-center justify-center">
                                                                <i className="fas fa-headset text-[var(--sidebar-icon-size)] text-blue-500/85 group-hover:text-blue-700 dark:text-cyan-300/85 dark:group-hover:text-cyan-200" />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="truncate text-[var(--sidebar-item-font)] font-medium tracking-[0.005em] text-slate-700 group-hover:text-slate-900 dark:text-white/88 dark:group-hover:text-white">
                                                                    Suporte
                                                                </p>
                                                            </div>
                                                        </button>
                                                    )}
                                                </div>
                                            </section>
                                        );
                                    })}
                                </div>

                                <div className="relative z-10 border-t border-slate-200/80 px-[calc(var(--sidebar-pad-x)-0.08rem)] pb-[calc(var(--sidebar-pad-bottom)+var(--sidebar-safe-bottom))] pt-[var(--sidebar-pad-bottom)] dark:border-cyan-300/16">
                                    <ThemeToggle variant="sidebar" className="mb-2" />
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

            <SupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />
        </>
    );
};

export default React.memo(Header);
