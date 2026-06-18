import React from 'react';

interface EstoqueMobileFooterProps {
    activeTab: 'bobinas' | 'retalhos';
    viewMode: 'grid' | 'list';
    onAdd: () => void;
    onScan: () => void;
    onOpenSearch: () => void;
    onOpenFilter: () => void;
    onToggleView: () => void;
    filterActive?: boolean;
}

const FooterButton: React.FC<{ onClick: () => void; label: string; icon: string; active?: boolean }> = ({ onClick, label, icon, active }) => (
    <button
        onClick={onClick}
        aria-label={label}
        className={`flex h-14 w-16 flex-col items-center justify-center rounded-xl transition-all duration-300 group ${active
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
            }`}
    >
        <i className={`${icon} text-lg transition-transform duration-300 group-active:scale-90`}></i>
        <span className="mt-1 text-[9px] font-bold uppercase tracking-wider">{label}</span>
    </button>
);

/** Footer flutuante de ações rápidas do Estoque (somente mobile). */
const EstoqueMobileFooter: React.FC<EstoqueMobileFooterProps> = ({
    activeTab,
    viewMode,
    onAdd,
    onScan,
    onOpenSearch,
    onOpenFilter,
    onToggleView,
    filterActive,
}) => {
    return (
        <div
            className="fixed left-4 right-4 z-40 sm:hidden"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
        >
            <div className="rounded-2xl border border-white/20 bg-white/95 px-2 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-xl dark:border-slate-800/50 dark:bg-slate-900/95 dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                <div className="relative flex items-center justify-between">
                    <div className="flex gap-1">
                        <FooterButton onClick={onOpenSearch} label="Buscar" icon="fas fa-search" />
                        <FooterButton onClick={onScan} label="QR" icon="fas fa-qrcode" />
                    </div>

                    <div className="absolute left-1/2 -top-12 -translate-x-1/2">
                        <button
                            onClick={onAdd}
                            aria-label={activeTab === 'bobinas' ? 'Nova bobina' : 'Novo retalho'}
                            className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-white bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-[0_8px_20px_rgba(21,94,239,0.4)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(21,94,239,0.5)] active:scale-95 dark:border-slate-900"
                        >
                            <i className="fas fa-plus text-2xl"></i>
                        </button>
                    </div>

                    <div className="flex gap-1">
                        <FooterButton onClick={onOpenFilter} label="Filtro" icon="fas fa-sliders-h" active={filterActive} />
                        <FooterButton
                            onClick={onToggleView}
                            label="Ver"
                            icon={viewMode === 'grid' ? 'fas fa-list' : 'fas fa-th-large'}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EstoqueMobileFooter;
