import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import SyncStatusIndicator from './SyncStatusIndicator';

type ActiveTab = 'client' | 'films' | 'settings' | 'history' | 'agenda' | 'sales' | 'admin' | 'account' | 'estoque';

interface HeaderProps {
    activeTab: ActiveTab;
    onTabChange: (tab: ActiveTab) => void;
}

const Header: React.FC<HeaderProps> = ({
    activeTab,
    onTabChange,
}) => {
    const { isAdmin } = useAuth();

    const TabButton: React.FC<{ tabId: ActiveTab; children: React.ReactNode, icon: string }> = ({ tabId, children, icon }) => {
        const isActive = activeTab === tabId;
        return (
            <button
                onClick={() => onTabChange(tabId)}
                className={`px-2 py-1.5 text-sm font-semibold rounded-lg transition-all duration-300 flex-1 flex items-center justify-center gap-2 transform ${isActive
                    ? 'bg-slate-800 text-white shadow-lg scale-105 dark:bg-slate-900'
                    : 'text-slate-600 hover:bg-slate-200 hover:scale-100 dark:text-slate-300 dark:hover:bg-slate-600'
                    }`}
            >
                <i className={`${icon} text-sm`}></i>
                <span className="hidden sm:inline">{children}</span>
            </button>
        );
    };

    return (
        <div className="space-y-2">
            {/* Indicador de Sincronização */}
            <div className="flex justify-end">
                <SyncStatusIndicator />
            </div>

            {/* Tabs de navegação */}
            <div className="flex justify-center">
                <div className="flex space-x-1 p-0.5 bg-slate-100 dark:bg-slate-700 rounded-xl w-full overflow-x-auto">
                    <TabButton tabId="client" icon="fas fa-user-friends">Cliente</TabButton>
                    <TabButton tabId="films" icon="fas fa-layer-group">Películas</TabButton>
                    <TabButton tabId="estoque" icon="fas fa-boxes">Estoque</TabButton>
                    <TabButton tabId="agenda" icon="fas fa-calendar-alt">Agenda</TabButton>
                    <TabButton tabId="history" icon="fas fa-history">Histórico</TabButton>
                    <TabButton tabId="settings" icon="fas fa-cog">Empresa</TabButton>
                    <TabButton tabId="account" icon="fas fa-user-circle">Conta</TabButton>
                    {isAdmin && <TabButton tabId="admin" icon="fas fa-user-shield">Admin</TabButton>}
                </div>
            </div>
        </div>
    );
};

export default React.memo(Header);