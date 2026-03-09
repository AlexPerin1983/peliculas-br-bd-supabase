import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import SyncStatusIndicator from '../SyncStatusIndicator';

type ActiveTab = 'client' | 'films' | 'settings' | 'history' | 'agenda' | 'sales' | 'admin' | 'account' | 'estoque' | 'qr_code';

interface DesktopSidebarProps {
    activeTab: ActiveTab;
    onTabChange: (tab: ActiveTab) => void;
}

const DesktopSidebar: React.FC<DesktopSidebarProps> = ({ activeTab, onTabChange }) => {
    const { isAdmin, user } = useAuth();

    const NavItem: React.FC<{ tabId: ActiveTab; icon: string; label: string }> = ({ tabId, icon, label }) => {
        const isActive = activeTab === tabId;
        return (
            <button
                onClick={() => onTabChange(tabId)}
                className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
                    ${isActive
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                    }
                `}
            >
                <i className={`${icon} text-lg ${isActive ? 'text-white' : 'group-hover:text-blue-600 dark:group-hover:text-blue-400'}`}></i>
                <span className="font-semibold">{label}</span>
            </button>
        );
    };

    return (
        <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-colors duration-500">
            <div className="p-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    Películas<span className="text-blue-600 dark:text-blue-400">BR</span>
                </h1>
            </div>

            <nav className="flex-grow px-4 space-y-1 overflow-y-auto">
                <div className="py-4 space-y-1">
                    <p className="px-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Principal</p>
                    <NavItem tabId="client" icon="fas fa-user-friends" label="Clientes" />
                    <NavItem tabId="films" icon="fas fa-layer-group" label="Películas" />
                    <NavItem tabId="estoque" icon="fas fa-boxes" label="Estoque" />
                    <NavItem tabId="qr_code" icon="fas fa-qrcode" label="QR Code" />
                    <NavItem tabId="agenda" icon="fas fa-calendar-alt" label="Agenda" />
                    <NavItem tabId="history" icon="fas fa-history" label="Histórico" />
                </div>

                <div className="py-4 space-y-1 border-t border-slate-100 dark:border-slate-800">
                    <p className="px-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Sistema</p>
                    {isAdmin && <NavItem tabId="admin" icon="fas fa-user-shield" label="Admin" />}
                    <NavItem tabId="settings" icon="fas fa-cog" label="Configurações" />
                    <NavItem tabId="account" icon="fas fa-user-circle" label="Minha Conta" />
                </div>
            </nav>

            <div className="p-4 mt-auto border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4 px-2">
                    <SyncStatusIndicator />
                </div>

                <div className="flex items-center gap-3 px-2 py-2 mb-2">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
                        <i className="fas fa-user"></i>
                    </div>
                    <div className="flex-grow min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {user?.email?.split('@')[0] || 'Usuário'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {user?.email || ''}
                        </p>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default React.memo(DesktopSidebar);
