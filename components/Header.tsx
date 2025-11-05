import React from 'react';

type ActiveTab = 'client' | 'films' | 'settings' | 'history' | 'agenda';

interface HeaderProps {
    activeTab: ActiveTab;
    onTabChange: (tab: ActiveTab) => void;
}

const Header: React.FC<HeaderProps> = ({
    activeTab,
    onTabChange,
}) => {
    
    const TabButton: React.FC<{ tabId: ActiveTab; children: React.ReactNode, icon: string }> = ({ tabId, children, icon }) => {
        const isActive = activeTab === tabId;
        return (
            <button
                onClick={() => onTabChange(tabId)}
                className={`px-2 py-1.5 text-sm font-semibold rounded-lg transition-all duration-300 flex-1 flex items-center justify-center gap-2 transform ${
                    isActive
                        ? 'bg-slate-800 text-white shadow-lg scale-105'
                        : 'text-slate-600 hover:bg-slate-200 hover:scale-100'
                }`}
            >
                <i className={`${icon} text-sm`}></i>
                <span className="hidden sm:inline">{children}</span>
            </button>
        );
    };

    return (
        <div>
            <div className="flex justify-center">
                <div className="flex space-x-1 p-0.5 bg-slate-100 rounded-xl w-full">
                    <TabButton tabId="client" icon="fas fa-user-friends">Cliente</TabButton>
                    <TabButton tabId="films" icon="fas fa-layer-group">Películas</TabButton>
                    <TabButton tabId="agenda" icon="fas fa-calendar-alt">Agenda</TabButton>
                    <TabButton tabId="history" icon="fas fa-history">Histórico</TabButton>
                    <TabButton tabId="settings" icon="fas fa-cog">Empresa</TabButton>
                </div>
            </div>
        </div>
    );
};

export default React.memo(Header);