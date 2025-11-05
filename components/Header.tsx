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
        <div className="flex justify-center items-center bg-white/70 backdrop-blur-sm">
            <div className="flex justify-between overflow-x-auto w-full">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        // py-2 para reduzir a altura em ~10% (menor que py-2.5) e text-base para reduzir o ícone em ~20% (menor que text-lg)
                        className={`flex flex-col items-center justify-center py-2 rounded-2xl transition-all duration-300 ease-in-out flex-1 mx-0.5 first:ml-0 last:mr-0 ${
                            activeTab === tab.id
                                ? 'bg-slate-800 text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                        }`}
                        aria-label={tab.label}
                    >
                        {/* text-base para ícone ~20% menor */}
                        <i className={`${tab.icon} text-base`}></i>
                        <span className="hidden sm:inline text-xs font-medium mt-1">{tab.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default Header;