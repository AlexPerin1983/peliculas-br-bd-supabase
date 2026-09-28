import React from 'react';
import { Layers3, Plus, ScanLine, Scissors, Search } from 'lucide-react';
import type { EstoqueTab } from '../../../src/lib/estoqueQuickFilters';

interface EstoqueMobileFooterProps {
    activeTab: EstoqueTab;
    lowStockCount: number;
    onChangeTab: (tab: EstoqueTab) => void;
    onAdd: () => void;
    onScan: () => void;
    onSearch: () => void;
}

const FooterButton: React.FC<{
    onClick: () => void;
    label: string;
    icon: React.ReactNode;
    active?: boolean;
    badge?: number;
}> = ({ onClick, label, icon, active, badge }) => (
    <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={active}
        className={`group relative flex h-14 w-16 flex-col items-center justify-center rounded-xl transition-all duration-200 ${active
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]'}`}
    >
        <span className="transition-transform duration-300 group-active:scale-90">{icon}</span>
        <span className="mt-1 text-[9px] font-bold uppercase tracking-wider">{label}</span>
        {badge && badge > 0 ? (
            <span className="absolute right-1.5 top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold leading-none text-white">
                {badge > 99 ? '99+' : badge}
            </span>
        ) : null}
    </button>
);

/** Menu fixo do estoque (somente celular), no mesmo formato das outras telas. */
const EstoqueMobileFooter: React.FC<EstoqueMobileFooterProps> = ({ activeTab, lowStockCount, onChangeTab, onAdd, onScan, onSearch }) => (
    <div className="fixed left-4 right-4 z-40 sm:hidden" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
        <nav aria-label="Menu do estoque" className="rounded-2xl border border-white/20 bg-white/95 px-2 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-xl dark:border-slate-800/50 dark:bg-slate-900/95 dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <div className="relative flex items-center justify-between">
                <div className="flex gap-1">
                    <FooterButton onClick={() => onChangeTab('bobinas')} label="Bobinas" icon={<Layers3 className="h-5 w-5" aria-hidden="true" />} active={activeTab === 'bobinas'} badge={lowStockCount} />
                    <FooterButton onClick={() => onChangeTab('retalhos')} label="Retalhos" icon={<Scissors className="h-5 w-5" aria-hidden="true" />} active={activeTab === 'retalhos'} />
                </div>

                <div className="absolute left-1/2 -top-12 -translate-x-1/2">
                    <button
                        type="button"
                        onClick={onAdd}
                        aria-label="Cadastrar material"
                        className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-white bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-[0_8px_20px_rgba(21,94,239,0.4)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(21,94,239,0.5)] active:scale-95 dark:border-slate-900"
                    >
                        <Plus className="h-7 w-7" aria-hidden="true" />
                    </button>
                </div>

                <div className="flex gap-1">
                    <FooterButton onClick={onScan} label="Escanear" icon={<ScanLine className="h-5 w-5" aria-hidden="true" />} />
                    <FooterButton onClick={onSearch} label="Buscar" icon={<Search className="h-5 w-5" aria-hidden="true" />} />
                </div>
            </div>
        </nav>
    </div>
);

export default EstoqueMobileFooter;
