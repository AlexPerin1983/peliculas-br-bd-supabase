import React from 'react';
import Tooltip from './ui/Tooltip';

interface AppHeaderProps {
    toggleFullScreen: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ toggleFullScreen }) => {
    return (
        <header className="flex-shrink-0 bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-20">
            <div className="container mx-auto px-4 sm:px-6 py-3">
                <div className="flex justify-end items-center gap-4">
                    {/* Action Buttons */}
                    <div className="flex items-center space-x-1 text-slate-500 flex-shrink-0">
                        <Tooltip text="Atualizar App">
                            <button onClick={() => window.location.reload()} className="h-10 w-10 flex items-center justify-center hover:bg-slate-100 rounded-full">
                                <i className="fas fa-sync-alt"></i>
                            </button>
                        </Tooltip>
                        <Tooltip text="Tela Cheia">
                            <button onClick={toggleFullScreen} className="h-10 w-10 flex items-center justify-center hover:bg-slate-100 rounded-full">
                                <i className="fas fa-expand-arrows-alt"></i>
                            </button>
                        </Tooltip>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default AppHeader;