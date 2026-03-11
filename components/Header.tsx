import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import SyncStatusIndicator from './SyncStatusIndicator';

type ActiveTab = 'client' | 'films' | 'settings' | 'history' | 'agenda' | 'sales' | 'admin' | 'account' | 'estoque' | 'qr_code' | 'fornecedores';

interface HeaderProps {
    activeTab: ActiveTab;
    onTabChange: (tab: ActiveTab) => void;
}

const MAIN_NAV: { tabId: ActiveTab; icon: string; label: string }[] = [
    { tabId: 'client',       icon: 'fas fa-user-friends',  label: 'Clientes'     },
    { tabId: 'films',        icon: 'fas fa-layer-group',   label: 'Películas'    },
    { tabId: 'estoque',      icon: 'fas fa-boxes',         label: 'Estoque'      },
    { tabId: 'qr_code',      icon: 'fas fa-qrcode',        label: 'QR Code'      },
    { tabId: 'agenda',       icon: 'fas fa-calendar-alt',  label: 'Agenda'       },
    { tabId: 'history',      icon: 'fas fa-history',       label: 'Histórico'    },
    { tabId: 'fornecedores', icon: 'fas fa-truck',         label: 'Fornecedores' },
];

const SYSTEM_NAV: { tabId: ActiveTab; icon: string; label: string }[] = [
    { tabId: 'settings', icon: 'fas fa-cog',         label: 'Configurações' },
    { tabId: 'account',  icon: 'fas fa-user-circle', label: 'Minha Conta'  },
];

const pageLabels: Record<string, string> = {
    client: 'Clientes', films: 'Películas', estoque: 'Estoque',
    qr_code: 'QR Code', agenda: 'Agenda', history: 'Histórico',
    fornecedores: 'Fornecedores', admin: 'Admin',
    settings: 'Configurações', account: 'Minha Conta',
};

const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange }) => {
    const { isAdmin, user } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        document.body.style.overflow = menuOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [menuOpen]);

    useEffect(() => {
        if (!menuOpen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [menuOpen]);

    const handleNav = (tab: ActiveTab) => {
        onTabChange(tab);
        setMenuOpen(false);
    };

    const initials = (user?.email || 'U').split('@')[0].slice(0, 2).toUpperCase();

    const allNavItems = [
        ...MAIN_NAV,
        ...(isAdmin ? [{ tabId: 'admin' as ActiveTab, icon: 'fas fa-user-shield', label: 'Admin' }] : []),
    ];

    return (
        <>
            {/* ── Top Bar ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {/* Hamburger — mobile only */}
                    <button
                        onClick={() => setMenuOpen(true)}
                        aria-label="Abrir menu"
                        className="lg:hidden flex flex-col items-center justify-center gap-[5px] w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <span className="w-5 h-[2px] bg-slate-700 dark:bg-slate-200 rounded-full" />
                        <span className="w-3.5 h-[2px] bg-slate-700 dark:bg-slate-200 rounded-full self-start ml-2" />
                        <span className="w-5 h-[2px] bg-slate-700 dark:bg-slate-200 rounded-full" />
                    </button>

                    <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight lg:hidden">
                        Películas<span className="text-blue-600 dark:text-blue-400">BR</span>
                    </h1>
                    <h2 className="hidden lg:block text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                        {pageLabels[activeTab] || ''}
                    </h2>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-full lg:hidden">
                        <button onClick={() => handleNav('settings')} aria-label="Configurações"
                            className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${activeTab === 'settings' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}>
                            <i className="fas fa-cog text-base" />
                        </button>
                        <button onClick={() => handleNav('account')} aria-label="Minha Conta"
                            className={`w-9 h-9 flex items-center justify-center rounded-full transition-all ${activeTab === 'account' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}>
                            <i className="fas fa-user-circle text-base" />
                        </button>
                    </div>
                    <SyncStatusIndicator />
                </div>
            </div>

            {/* ── Full-screen Menu — rendered via portal to escape stacking context ── */}
            {menuOpen && ReactDOM.createPortal(
                <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-950">

                    {/* Top bar inside menu */}
                    <div className="flex items-center justify-between px-5 pt-12 pb-5 flex-shrink-0">
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-900/50">
                                <i className="fas fa-layer-group text-white text-sm" />
                            </div>
                            <span className="text-xl font-bold text-white tracking-tight">
                                Películas<span className="text-blue-400">BR</span>
                            </span>
                        </div>
                        <button
                            onClick={() => setMenuOpen(false)}
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20 text-white transition-colors"
                            aria-label="Fechar menu"
                        >
                            <i className="fas fa-times text-lg" />
                        </button>
                    </div>

                    {/* Nav list — scrollable */}
                    <div className="flex-1 overflow-y-auto px-4">

                        {/* Section: Principal */}
                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-2 mb-2">
                            Principal
                        </p>
                        <div className="space-y-1 mb-6">
                            {allNavItems.map(item => {
                                const isActive = activeTab === item.tabId;
                                return (
                                    <button
                                        key={item.tabId}
                                        onClick={() => handleNav(item.tabId)}
                                        className={`
                                            w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all active:scale-[0.98]
                                            ${isActive
                                                ? 'bg-blue-600/20 text-white'
                                                : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                                            }
                                        `}
                                    >
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-blue-600' : 'bg-white/8'}`}
                                            style={{ background: isActive ? '' : 'rgba(255,255,255,0.07)' }}>
                                            <i className={`${item.icon} text-base ${isActive ? 'text-white' : 'text-slate-400'}`} />
                                        </div>
                                        <span className={`text-base font-semibold ${isActive ? 'text-white' : 'text-slate-300'}`}>
                                            {item.label}
                                        </span>
                                        {isActive && (
                                            <span className="ml-auto w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Section: Sistema */}
                        <div className="border-t border-white/10 pt-5">
                            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-2 mb-2">
                                Sistema
                            </p>
                            <div className="space-y-1">
                                {SYSTEM_NAV.map(item => {
                                    const isActive = activeTab === item.tabId;
                                    return (
                                        <button
                                            key={item.tabId}
                                            onClick={() => handleNav(item.tabId)}
                                            className={`
                                                w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all active:scale-[0.98]
                                                ${isActive
                                                    ? 'bg-blue-600/20 text-white'
                                                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                                                }
                                            `}
                                        >
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                                style={{ background: isActive ? '#2563eb' : 'rgba(255,255,255,0.07)' }}>
                                                <i className={`${item.icon} text-base ${isActive ? 'text-white' : 'text-slate-400'}`} />
                                            </div>
                                            <span className={`text-base font-semibold ${isActive ? 'text-white' : 'text-slate-300'}`}>
                                                {item.label}
                                            </span>
                                            {isActive && (
                                                <span className="ml-auto w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Footer — user info */}
                    <div className="flex-shrink-0 px-4 py-5 border-t border-white/10">
                        <div className="flex items-center gap-3 px-2">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-lg">
                                {initials}
                            </div>
                            <div className="flex-grow min-w-0">
                                <p className="text-sm font-semibold text-white truncate">
                                    {user?.email?.split('@')[0] || 'Usuário'}
                                </p>
                                <p className="text-xs text-slate-500 truncate">
                                    {user?.email || ''}
                                </p>
                            </div>
                            <SyncStatusIndicator />
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default React.memo(Header);
