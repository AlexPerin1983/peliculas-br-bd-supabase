import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import SyncStatusIndicator from './SyncStatusIndicator';

type ActiveTab = 'client' | 'films' | 'settings' | 'history' | 'agenda' | 'sales' | 'admin' | 'account' | 'estoque' | 'qr_code';

interface HeaderProps {
    activeTab: ActiveTab;
    onTabChange: (tab: ActiveTab) => void;
}

const Header: React.FC<HeaderProps> = ({
    activeTab,
    onTabChange,
}) => {
    const { isAdmin } = useAuth();

    const TabButton: React.FC<{ tabId: ActiveTab; children: React.ReactNode, icon: string, label: string }> = ({ tabId, children, icon, label }) => {
        const isActive = activeTab === tabId;
        return (
            <button
                onClick={() => onTabChange(tabId)}
                aria-label={label}
                title={label}
                className={`relative px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-300 flex-1 flex flex-col sm:flex-row items-center justify-center gap-1.5 group outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:focus-visible:ring-slate-500 ${isActive
                    ? 'text-slate-900 dark:text-white'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
            >
                {/* Background Highlight for Active Tab */}
                {isActive && (
                    <span className="absolute inset-0 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 animate-pop-in z-0"></span>
                )}

                <i className={`${icon} text-base relative z-10 transition-transform duration-300 ${isActive ? 'scale-110 text-blue-600 dark:text-blue-400' : 'group-hover:scale-110'}`}></i>
                <span className="text-[10px] sm:text-sm font-semibold relative z-10 hidden xs:inline sm:inline">{children}</span>

                {/* Indicator Dot for Active Tab on Mobile */}
                {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-slate-900 dark:bg-white rounded-full sm:hidden"></span>
                )}
            </button>
        );
    };

    const HeaderIconButton: React.FC<{ tabId: ActiveTab; icon: string; label: string }> = ({ tabId, icon, label }) => {
        const isActive = activeTab === tabId;
        return (
            <button
                onClick={() => onTabChange(tabId)}
                aria-label={label}
                title={label}
                className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200 ${isActive
                    ? 'bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
            >
                <i className={`${icon} text-lg`}></i>
            </button>
        );
    };

    return (
        <div className="space-y-3">
            {/* Top Bar: Logo/Title & Sync */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                        Películas<span className="text-blue-600 dark:text-blue-400">BR</span>
                    </h1>
                </div>
                <div className="flex items-center gap-1">
                    <HeaderIconButton tabId="settings" icon="fas fa-cog" label="Configurações" />
                    <HeaderIconButton tabId="account" icon="fas fa-user-circle" label="Minha Conta" />
                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                    <SyncStatusIndicator />
                </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex justify-center">
                <div className="flex items-center p-1 bg-slate-100/80 dark:bg-slate-900/50 backdrop-blur-md rounded-2xl w-full overflow-x-auto no-scrollbar border border-slate-200/50 dark:border-slate-800/50 shadow-inner">
                    <TabButton tabId="client" icon="fas fa-user-friends" label="Clientes">Cliente</TabButton>
                    <TabButton tabId="films" icon="fas fa-layer-group" label="Películas">Películas</TabButton>
                    <TabButton tabId="estoque" icon="fas fa-boxes" label="Estoque">Estoque</TabButton>
                    <TabButton tabId="qr_code" icon="fas fa-qrcode" label="QR Code">QR Code</TabButton>
                    <TabButton tabId="agenda" icon="fas fa-calendar-alt" label="Agenda">Agenda</TabButton>
                    <TabButton tabId="history" icon="fas fa-history" label="Histórico">Histórico</TabButton>
                    {isAdmin && <TabButton tabId="admin" icon="fas fa-user-shield" label="Painel Admin">Admin</TabButton>}
                </div>
            </nav>
        </div>
    );
};

export default React.memo(Header);