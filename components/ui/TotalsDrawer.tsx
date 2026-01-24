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

    // Sync local state when props change
    useEffect(() => {
        setDiscountValue(generalDiscount.value);
        setDiscountType(generalDiscount.type);
    }, [generalDiscount]);

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

    return (
        <Drawer.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
                <Drawer.Content className="bg-white dark:bg-slate-900 flex flex-col rounded-t-[10px] h-auto mt-24 fixed bottom-0 left-0 right-0 z-50 outline-none border-t border-slate-200 dark:border-slate-700">
                    <div className="p-4 bg-white dark:bg-slate-900 rounded-t-[10px] flex-1">
                        <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-slate-300 dark:bg-slate-700 mb-6" />

                        <div className="max-w-md mx-auto space-y-6">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Resumo de Valores</h2>

                            {/* Summary Rows */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                                    <span>Subtotal ({totals.totalM2.toFixed(2)} m²)</span>
                                    <span className="font-medium text-slate-900 dark:text-white">{formatNumberBR(totals.subtotal)}</span>
                                </div>

                                {totals.totalLinearMeters > 0 && (
                                    <div className="flex justify-between items-center text-blue-600 dark:text-blue-400">
                                        <span>Metro Linear ({totals.totalLinearMeters.toFixed(2)} m)</span>
                                        <span className="font-medium">{formatNumberBR(totals.linearMeterCost)}</span>
                                    </div>
                                )}

                                {totals.totalItemDiscount > 0 && (
                                    <div className="flex justify-between items-center text-red-500 dark:text-red-400">
                                        <span>Descontos nos itens</span>
                                        <span className="font-medium">-{formatNumberBR(totals.totalItemDiscount)}</span>
                                    </div>
                                )}
                            </div>

                            {/* Inline Discount Input */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Desconto Geral
                                </label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            value={discountValue}
                                            onChange={(e) => handleDiscountChange(e.target.value)}
                                            placeholder="0,00"
                                            className="w-full pl-3 pr-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white text-lg font-medium"
                                        />
                                    </div>
                                    <button
                                        onClick={handleTypeToggle}
                                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors min-w-[60px] flex items-center justify-center gap-2"
                                    >
                                        <i className="fas fa-exchange-alt text-xs opacity-50"></i>
                                        <span>{discountType === 'percentage' ? '%' : 'R$'}</span>
                                    </button>
                                </div>
                                {totals.generalDiscountAmount > 0 && (
                                    <div className="mt-2 text-sm text-right text-green-600 dark:text-green-400 font-medium">
                                        Desconto aplicado: -{formatNumberBR(totals.generalDiscountAmount)}
                                    </div>
                                )}
                            </div>

                            {/* Final Total */}
                            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                                <div className="flex justify-between items-end">
                                    <span className="text-lg font-medium text-slate-900 dark:text-white">Total Final</span>
                                    <span className="text-3xl font-bold text-slate-900 dark:text-white">{formatNumberBR(totals.finalTotal)}</span>
                                </div>
                            </div>

                            <button
                                onClick={onClose}
                                className="w-full py-3.5 bg-slate-900 dark:bg-slate-700 text-white rounded-xl font-semibold text-lg shadow-lg shadow-slate-900/10 active:scale-[0.98] transition-all"
                            >
                                Concluir
                            </button>
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
};
