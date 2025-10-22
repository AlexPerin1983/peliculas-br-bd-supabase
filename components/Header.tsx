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
                className={`px-3 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 flex-1 flex items-center justify-center gap-2 ${
                    isActive
                        ? 'bg-slate-800 text-white shadow'
                        : 'text-slate-600 hover:bg-slate-200'
                }`}
            >
                <i className={`${icon} text-base`}></i>
                <span className="hidden sm:inline">{children}</span>
            </button>
        );
    };

    return (
        <div>
            <div className="flex justify-center">
                <div className="flex space-x-1 p-1 bg-slate-100 rounded-xl w-full">
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