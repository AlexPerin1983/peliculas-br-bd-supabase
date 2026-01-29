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

    const TabButton: React.FC<{ tabId: ActiveTab; icon: string; label: string }> = ({ tabId, icon, label }) => {
        const isActive = activeTab === tabId;
        return (
            <button
                onClick={() => onTabChange(tabId)}
                aria-label={label}
                title={label}
                className={`
                    flex-1 min-w-0 py-2.5 text-sm font-semibold rounded-xl 
                    transition-all duration-200 flex items-center justify-center gap-2
                    ${isActive
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200/50 dark:border-slate-700/50'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }
                `}
            >
                <i className={`${icon} text-base ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`}></i>
                <span className="hidden sm:inline truncate">{label}</span>
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
                className={`
                    w-9 h-9 flex items-center justify-center rounded-full 
                    transition-all duration-200
                    ${isActive
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }
                `}
            >
                <i className={`${icon} text-base`}></i>
            </button>
        );
    };

    return (
        <div className="space-y-3">
            {/* Top Bar: Logo/Title & Actions */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                        Películas<span className="text-blue-600 dark:text-blue-400">BR</span>
                    </h1>
                </div>

                {/* Icon Group - Pill Container */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                        <HeaderIconButton tabId="settings" icon="fas fa-cog" label="Configurações" />
                        <HeaderIconButton tabId="account" icon="fas fa-user-circle" label="Minha Conta" />
                    </div>
                    <SyncStatusIndicator />
                </div>
            </div>

            {/* Navigation Tabs - Distribuídos de ponta a ponta */}
            <nav className="-mx-4 px-4" aria-label="Navegação principal">
                <div className="flex items-center gap-1 sm:gap-1.5 p-1.5 bg-slate-100/60 dark:bg-slate-800/60 rounded-2xl w-full">
                    <TabButton tabId="client" icon="fas fa-user-friends" label="Clientes" />
                    <TabButton tabId="films" icon="fas fa-layer-group" label="Películas" />
                    <TabButton tabId="estoque" icon="fas fa-boxes" label="Estoque" />
                    <TabButton tabId="qr_code" icon="fas fa-qrcode" label="QR Code" />
                    <TabButton tabId="agenda" icon="fas fa-calendar-alt" label="Agenda" />
                    <TabButton tabId="history" icon="fas fa-history" label="Histórico" />
                    {isAdmin && <TabButton tabId="admin" icon="fas fa-user-shield" label="Admin" />}
                </div>
            </nav>
        </div>
    );
};

export default React.memo(Header);