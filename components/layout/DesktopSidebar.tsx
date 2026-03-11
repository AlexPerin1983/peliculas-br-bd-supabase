import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import SyncStatusIndicator from '../SyncStatusIndicator';

type ActiveTab = 'client' | 'films' | 'settings' | 'history' | 'agenda' | 'sales' | 'admin' | 'account' | 'estoque' | 'qr_code' | 'fornecedores';

interface DesktopSidebarProps {
    activeTab: ActiveTab;
    onTabChange: (tab: ActiveTab) => void;
}

const DesktopSidebar: React.FC<DesktopSidebarProps> = ({ activeTab, onTabChange }) => {
    const { isAdmin, user } = useAuth();

    const initials = (user?.email || 'U')
        .split('@')[0]
        .slice(0, 2)
        .toUpperCase();

    const NavItem: React.FC<{ tabId: ActiveTab; icon: string; label: string }> = ({ tabId, icon, label }) => {
        const isActive = activeTab === tabId;
        return (
            <button
                onClick={() => onTabChange(tabId)}
                className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative
                    ${isActive
                        ? 'bg-white/10 text-white'
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                    }
                `}
            >
                {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-400 rounded-r-full" />
                )}
                <i className={`${icon} w-5 text-center text-sm transition-colors ${isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`}></i>
                <span className={`font-semibold text-sm ${isActive ? 'text-white' : ''}`}>{label}</span>
                {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />
                )}
            </button>
        );
    };

    return (
        <aside className="hidden lg:flex flex-col w-60 h-screen sticky top-0 bg-slate-900 border-r border-slate-800 transition-colors duration-500">

            {/* Logo */}
            <div className="px-5 py-6 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-900/50 flex-shrink-0">
                        <i className="fas fa-layer-group text-white text-sm"></i>
                    </div>
                    <h1 className="text-lg font-bold text-white tracking-tight">
                        Películas<span className="text-blue-400">BR</span>
                    </h1>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-grow px-3 py-4 space-y-0.5 overflow-y-auto">
                <p className="px-3 text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">Principal</p>
                <NavItem tabId="client"   icon="fas fa-user-friends"  label="Clientes"   />
                <NavItem tabId="films"    icon="fas fa-layer-group"   label="Películas"  />
                <NavItem tabId="estoque"  icon="fas fa-boxes"         label="Estoque"    />
                <NavItem tabId="qr_code"  icon="fas fa-qrcode"        label="QR Code"    />
                <NavItem tabId="agenda"   icon="fas fa-calendar-alt"  label="Agenda"     />
                <NavItem tabId="history"      icon="fas fa-history"       label="Histórico"    />
                <NavItem tabId="fornecedores" icon="fas fa-truck"          label="Fornecedores" />

                <div className="pt-4 mt-2 border-t border-slate-800 space-y-0.5">
                    <p className="px-3 text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">Sistema</p>
                    {isAdmin && <NavItem tabId="admin"    icon="fas fa-user-shield"  label="Admin"         />}
                    <NavItem tabId="settings" icon="fas fa-cog"          label="Configurações" />
                    <NavItem tabId="account"  icon="fas fa-user-circle"  label="Minha Conta"   />
                </div>
            </nav>

            {/* Footer */}
            <div className="px-4 py-4 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between px-1">
                    <SyncStatusIndicator />
                </div>

                <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-default">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-lg shadow-blue-900/40">
                        {initials}
                    </div>
                    <div className="flex-grow min-w-0">
                        <p className="text-sm font-semibold text-white truncate leading-tight">
                            {user?.email?.split('@')[0] || 'Usuário'}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">
                            {user?.email || ''}
                        </p>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default React.memo(DesktopSidebar);
