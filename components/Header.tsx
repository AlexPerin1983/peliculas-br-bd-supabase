import React from 'react';
import { ActiveTab } from '../types';

interface HeaderProps {
    activeTab: ActiveTab;
    onTabChange: (tab: ActiveTab) => void;
}

const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange }) => {
    const tabs: { id: ActiveTab; icon: string; label: string }[] = [
        { id: 'client', icon: 'fas fa-calculator', label: 'Orçamento' },
        { id: 'films', icon: 'fas fa-layer-group', label: 'Películas' },
        { id: 'agenda', icon: 'far fa-calendar-alt', label: 'Agenda' },
        { id: 'history', icon: 'fas fa-history', label: 'Histórico' },
        { id: 'settings', icon: 'fas fa-cog', label: 'Empresa' },
    ];

    return (
        <div className="flex justify-center items-center">
            {/* O título 'Películas BR' foi removido daqui para evitar quebras de layout no mobile/desktop */}
            <div className="flex justify-center overflow-x-auto space-x-2 sm:space-x-4 w-full sm:w-auto">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`flex items-center justify-center sm:justify-start px-3 py-2 rounded-lg transition-colors duration-200 flex-shrink-0 ${
                            activeTab === tab.id
                                ? 'bg-slate-800 text-white shadow-md'
                                : 'text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                        <i className={`${tab.icon} text-lg sm:mr-2`}></i>
                        <span className="hidden sm:inline text-sm font-semibold">{tab.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default Header;