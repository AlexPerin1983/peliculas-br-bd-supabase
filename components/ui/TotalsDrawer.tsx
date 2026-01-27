import React, { useState, useEffect } from 'react';
import { Drawer } from 'vaul';

import { Totals } from '../../types';

interface TotalsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    totals: Totals;
    generalDiscount: { value: string; type: 'percentage' | 'fixed' };
    onUpdateGeneralDiscount: (value: string, type: 'percentage' | 'fixed') => void;
}

const formatNumberBR = (number: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(number);
};

export const TotalsDrawer: React.FC<TotalsDrawerProps> = ({
    isOpen,
    onClose,
    totals,
    generalDiscount,
    onUpdateGeneralDiscount
}) => {
    const [discountValue, setDiscountValue] = useState(generalDiscount.value);
    const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>(generalDiscount.type);
    const [openGroup, setOpenGroup] = useState<string | null>(null);

    // Sync local state when props change
    useEffect(() => {
        setDiscountValue(generalDiscount.value);
        setDiscountType(generalDiscount.type);
    }, [generalDiscount]);

    // Abrir o primeiro grupo por padrão
    useEffect(() => {
        if (totals.groupedTotals && Object.keys(totals.groupedTotals).length > 0 && !openGroup) {
            setOpenGroup(Object.keys(totals.groupedTotals)[0]);
        }
    }, [totals.groupedTotals]);

    const handleDiscountChange = (value: string) => {
        // Allow only numbers and comma
        const cleanValue = value.replace(/[^0-9,]/g, '');
        setDiscountValue(cleanValue);
        onUpdateGeneralDiscount(cleanValue, discountType);
    };

    const handleTypeToggle = () => {
        const newType = discountType === 'percentage' ? 'fixed' : 'percentage';
        setDiscountType(newType);
        onUpdateGeneralDiscount(discountValue, newType);
    };

    const toggleGroup = (filmName: string) => {
        setOpenGroup(openGroup === filmName ? null : filmName);
    };

    return (
        <Drawer.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
                <Drawer.Content className="bg-white dark:bg-slate-900 flex flex-col rounded-t-[20px] h-auto max-h-[90vh] fixed bottom-0 left-0 right-0 z-50 outline-none border-t border-slate-200 dark:border-slate-700">
                    <div className="p-4 bg-white dark:bg-slate-900 rounded-t-[20px] overflow-y-auto">
                        <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-slate-300 dark:bg-slate-700 mb-6" />

                        <div className="max-w-md mx-auto space-y-6 pb-8">
                            <div className="flex justify-between items-center">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Resumo de Valores</h2>
                                <button
                                    onClick={onClose}
                                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                    aria-label="Fechar"
                                >
                                    <i className="fas fa-times text-lg"></i>
                                </button>
                            </div>

                            {/* Seção Resumo Global */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Área Total</span>
                                    <span className="text-lg font-bold text-slate-900 dark:text-white">{totals.totalM2.toFixed(2)} m²</span>
                                </div>
                                {totals.totalLinearMeters > 0 && (
                                    <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Metro Linear</span>
                                        <span className="text-lg font-bold text-slate-900 dark:text-white">{totals.totalLinearMeters.toFixed(2)} m</span>
                                    </div>
                                )}
                            </div>

                            {/* Detalhamento por Película */}
                            {totals.groupedTotals && Object.keys(totals.groupedTotals).length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">Detalhamento por Película</h3>
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                        {Object.values(totals.groupedTotals).map((group: any) => (
                                            <div
                                                key={group.filmName}
                                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden transition-all duration-200"
                                            >
                                                <button
                                                    onClick={() => toggleGroup(group.filmName)}
                                                    className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                                                >
                                                    <div className="flex flex-col flex-1 min-w-0 mr-2">
                                                        <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                                            {group.filmName}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                                            {group.totalM2.toFixed(2)} m² {group.totalLinearMeters > 0 ? `| ${group.totalLinearMeters.toFixed(2)} m` : ''}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <i className={`fas fa-chevron-down text-[10px] text-slate-400 transition-transform duration-200 ${openGroup === group.filmName ? 'rotate-180' : ''}`}></i>
                                                    </div>
                                                </button>

                                                {openGroup === group.filmName && (
                                                    <div className="px-3 pb-3 pt-1 space-y-2 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50">
                                                        {/* Material */}
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex flex-col">
                                                                <span className="text-[11px] text-slate-500 dark:text-slate-400">Material</span>
                                                                <span className="text-[10px] font-medium text-slate-400">{formatNumberBR(group.unitPriceMaterial)}/m²</span>
                                                            </div>
                                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{formatNumberBR(group.totalMaterial)}</span>
                                                        </div>

                                                        {/* Mão de Obra */}
                                                        {group.unitPriceLabor > 0 && (
                                                            <div className="flex justify-between items-center">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Mão de Obra</span>
                                                                    <span className="text-[10px] font-medium text-slate-400">{formatNumberBR(group.unitPriceLabor)}/m²</span>
                                                                </div>
                                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{formatNumberBR(group.totalLabor)}</span>
                                                            </div>
                                                        )}

                                                        {/* Metro Linear */}
                                                        {group.totalLinearMeters > 0 && group.unitPriceLinearMeter > 0 && (
                                                            <div className="flex justify-between items-center">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Custo Metro Linear</span>
                                                                    <span className="text-[10px] font-medium text-slate-400">{formatNumberBR(group.unitPriceLinearMeter)}/m</span>
                                                                </div>
                                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{formatNumberBR(group.totalLinearMeterCost)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Resumo de Custos Totais */}
                            <div className="bg-slate-900 dark:bg-slate-800 rounded-2xl p-4 space-y-3 border border-slate-800 dark:border-slate-700 shadow-lg">
                                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Resumo de Custos</h3>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-slate-400">Total Material</span>
                                        <span className="text-sm font-bold text-white">{formatNumberBR(totals.totalMaterial)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-slate-400">Total Mão de Obra</span>
                                        <span className="text-sm font-bold text-white">{formatNumberBR(totals.totalLabor)}</span>
                                    </div>
                                    {totals.linearMeterCost > 0 && (
                                        <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                                            <span className="text-xs text-blue-400">Total Metro Linear</span>
                                            <span className="text-sm font-bold text-blue-400">{formatNumberBR(totals.linearMeterCost)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Seção Desconto */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                        Desconto Geral
                                    </label>
                                    {totals.generalDiscountAmount > 0 && (
                                        <span className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
                                            -{formatNumberBR(totals.generalDiscountAmount)}
                                        </span>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={discountValue}
                                            onChange={(e) => handleDiscountChange(e.target.value)}
                                            placeholder="0,00"
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white text-lg font-bold transition-all"
                                        />
                                    </div>
                                    <button
                                        onClick={handleTypeToggle}
                                        className="px-4 py-3 bg-slate-900 dark:bg-slate-700 text-white rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 min-w-[70px]"
                                    >
                                        <span>{discountType === 'percentage' ? '%' : 'R$'}</span>
                                        <i className="fas fa-sync-alt text-[10px] opacity-60"></i>
                                    </button>
                                </div>

                                {totals.totalItemDiscount > 0 && (
                                    <div className="flex justify-between items-center text-red-500 dark:text-red-400 text-sm px-1">
                                        <span>Descontos nos itens</span>
                                        <span className="font-bold">-{formatNumberBR(totals.totalItemDiscount)}</span>
                                    </div>
                                )}
                            </div>

                            {/* Total Final */}
                            <div className="pt-6 border-t-2 border-slate-100 dark:border-slate-800">
                                <div className="flex justify-between items-center">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Final</span>
                                        <span className="text-xs text-slate-400 dark:text-slate-500">Valor total do orçamento</span>
                                    </div>
                                    <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                                        {formatNumberBR(totals.finalTotal)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 10px;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #475569;
                }
            `}</style>
        </Drawer.Root>
    );
};
