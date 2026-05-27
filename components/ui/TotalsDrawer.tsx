import React, { useEffect, useState } from 'react';
import { Drawer } from 'vaul';
import { CircleDollarSign, MinusCircle, Percent, PlusCircle } from 'lucide-react';

import { ProposalDiscount, Totals } from '../../types';
import {
    getProposalAdjustmentInputs,
    normalizeAdjustmentInputValue,
    updateProposalAdjustmentInput,
} from '../../src/lib/proposalAdjustments';

interface TotalsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    totals: Totals;
    generalDiscount: ProposalDiscount;
    onUpdateGeneralDiscount: (discount: ProposalDiscount) => void;
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
    const [openGroup, setOpenGroup] = useState<string | null>(null);
    const adjustmentInputs = getProposalAdjustmentInputs(generalDiscount);
    const hiddenIncreaseAmount = totals.generalIncreaseAmount || 0;
    const finalDiscountAmount = totals.generalFinalDiscountAmount || 0;

    useEffect(() => {
        if (totals.groupedTotals && Object.keys(totals.groupedTotals).length > 0 && !openGroup) {
            setOpenGroup(Object.keys(totals.groupedTotals)[0]);
        }
    }, [totals.groupedTotals, openGroup]);

    const updateAdjustment = (
        kind: 'discount' | 'increase',
        input: Partial<{ value: string; type: 'percentage' | 'fixed' }>
    ) => {
        onUpdateGeneralDiscount(updateProposalAdjustmentInput(generalDiscount, kind, input));
    };

    const toggleGroup = (filmName: string) => {
        setOpenGroup(openGroup === filmName ? null : filmName);
    };

    const AdjustmentCard = ({
        kind,
        title,
        description,
        amount,
        tone
    }: {
        kind: 'discount' | 'increase';
        title: string;
        description: string;
        amount: number;
        tone: 'blue' | 'emerald';
    }) => {
        const input = adjustmentInputs[kind];
        const isPercentage = input.type === 'percentage';
        const sign = kind === 'increase' ? '+' : '-';
        const toneClasses = tone === 'blue'
            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300';

        return (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
                            {kind === 'increase'
                                ? <PlusCircle className="h-4 w-4 text-blue-500" aria-hidden="true" />
                                : <MinusCircle className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                            }
                            <span>{title}</span>
                        </div>
                        <p className="mt-1 text-xs leading-snug text-slate-500 dark:text-slate-400">{description}</p>
                    </div>
                    {amount > 0 && (
                        <span className={`rounded-full px-2 py-1 text-xs font-bold ${toneClasses}`}>
                            {sign}{formatNumberBR(amount)}
                        </span>
                    )}
                </div>

                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => updateAdjustment(kind, { type: isPercentage ? 'fixed' : 'percentage' })}
                        className="flex h-11 min-w-[72px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 text-sm font-bold text-white transition-all active:scale-95 dark:bg-slate-100 dark:text-slate-950"
                        aria-label={`Alternar ${title}`}
                    >
                        {isPercentage ? <Percent className="h-4 w-4" aria-hidden="true" /> : <CircleDollarSign className="h-4 w-4" aria-hidden="true" />}
                        <span>{isPercentage ? '%' : 'R$'}</span>
                    </button>
                    <input
                        type="text"
                        inputMode="decimal"
                        value={input.value}
                        onChange={(event) => updateAdjustment(kind, { value: normalizeAdjustmentInputValue(event.target.value) })}
                        placeholder={isPercentage ? '0' : '0,00'}
                        className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-right text-lg font-bold text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                </div>
            </div>
        );
    };

    return (
        <Drawer.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
                <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex h-auto max-h-[90vh] flex-col rounded-t-[20px] border-t border-slate-200 bg-white outline-none dark:border-slate-700 dark:bg-slate-900">
                    <div
                        className="overflow-y-auto rounded-t-[20px] bg-white p-4 dark:bg-slate-900"
                        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
                    >
                        <div className="mx-auto mb-6 h-1.5 w-12 flex-shrink-0 rounded-full bg-slate-300 dark:bg-slate-700" />

                        <div className="mx-auto max-w-md space-y-6 pb-8">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Resumo de Valores</h2>
                                <button
                                    onClick={onClose}
                                    className="p-2 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
                                    aria-label="Fechar"
                                >
                                    <i className="fas fa-times text-lg" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-700/50 dark:bg-slate-800/40">
                                    <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Área Total</span>
                                    <span className="text-lg font-semibold text-slate-900 dark:text-white">{totals.totalM2.toFixed(2)} m²</span>
                                </div>
                                {totals.totalLinearMeters > 0 && (
                                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-700/50 dark:bg-slate-800/40">
                                        <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Metro Linear</span>
                                        <span className="text-lg font-semibold text-slate-900 dark:text-white">{totals.totalLinearMeters.toFixed(2)} m</span>
                                    </div>
                                )}
                            </div>

                            {totals.groupedTotals && Object.keys(totals.groupedTotals).length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="px-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Detalhamento por Película</h3>
                                    <div className="custom-scrollbar max-h-[300px] space-y-2 overflow-y-auto pr-1">
                                        {Object.values(totals.groupedTotals).map((group: any) => (
                                            <div
                                                key={group.filmName}
                                                className="overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-200 dark:border-slate-700 dark:bg-slate-800"
                                            >
                                                <button
                                                    onClick={() => toggleGroup(group.filmName)}
                                                    className="flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                                >
                                                    <div className="mr-2 flex min-w-0 flex-1 flex-col">
                                                        <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                                            {group.filmName}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                                            {group.totalM2.toFixed(2)} m² {group.totalLinearMeters > 0 ? `| ${group.totalLinearMeters.toFixed(2)} m` : ''}
                                                        </span>
                                                    </div>
                                                    <i className={`fas fa-chevron-down text-[10px] text-slate-400 transition-transform duration-200 ${openGroup === group.filmName ? 'rotate-180' : ''}`} />
                                                </button>

                                                {openGroup === group.filmName && (
                                                    <div className="space-y-2 border-t border-slate-100 bg-slate-50/50 px-3 pb-3 pt-1 dark:border-slate-700/50 dark:bg-slate-800/50">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex flex-col">
                                                                <span className="text-[11px] text-slate-500 dark:text-slate-400">Material</span>
                                                                <span className="text-[10px] font-medium text-slate-400">{formatNumberBR(group.unitPriceMaterial)}/m²</span>
                                                            </div>
                                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{formatNumberBR(group.totalMaterial)}</span>
                                                        </div>

                                                        {group.unitPriceLabor > 0 && (
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Mão de Obra</span>
                                                                    <span className="text-[10px] font-medium text-slate-400">{formatNumberBR(group.unitPriceLabor)}/m²</span>
                                                                </div>
                                                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{formatNumberBR(group.totalLabor)}</span>
                                                            </div>
                                                        )}

                                                        {group.totalLinearMeters > 0 && group.unitPriceLinearMeter > 0 && (
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Custo Metro Linear</span>
                                                                    <span className="text-[10px] font-medium text-slate-400">{formatNumberBR(group.unitPriceLinearMeter)}/m</span>
                                                                </div>
                                                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{formatNumberBR(group.totalLinearMeterCost)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                                <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Resumo de Custos</h3>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-400">Total Material</span>
                                        <span className="text-sm font-semibold text-white">{formatNumberBR(totals.totalMaterial)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-400">Total Mão de Obra</span>
                                        <span className="text-sm font-semibold text-white">{formatNumberBR(totals.totalLabor)}</span>
                                    </div>
                                    {totals.linearMeterCost > 0 && (
                                        <div className="flex items-center justify-between border-t border-slate-800 pt-2">
                                            <span className="text-xs text-blue-400">Total Metro Linear</span>
                                            <span className="text-sm font-semibold text-blue-400">{formatNumberBR(totals.linearMeterCost)}</span>
                                        </div>
                                    )}
                                    {totals.operationalExpenses > 0 && (
                                        <div className="flex items-center justify-between border-t border-slate-800 pt-2">
                                            <span className="text-xs text-amber-300">Gastos informados</span>
                                            <span className="text-sm font-semibold text-amber-300">{formatNumberBR(totals.operationalExpenses)}</span>
                                        </div>
                                    )}
                                    {totals.estimatedTotalCost > 0 && (
                                        <>
                                            <div className="flex items-center justify-between border-t border-slate-800 pt-2">
                                                <span className="text-xs text-slate-300">Custo estimado</span>
                                                <span className="text-sm font-semibold text-white">{formatNumberBR(totals.estimatedTotalCost)}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-slate-300">Resultado estimado</span>
                                                <span className={`text-sm font-semibold ${totals.estimatedProfit >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                                                    {formatNumberBR(totals.estimatedProfit)} ({totals.estimatedMarginPercentage.toFixed(1)}%)
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                        Ajuste Geral
                                    </label>
                                    {(hiddenIncreaseAmount > 0 || finalDiscountAmount > 0) && (
                                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                            +{formatNumberBR(hiddenIncreaseAmount)} / -{formatNumberBR(finalDiscountAmount)}
                                        </span>
                                    )}
                                </div>

                                <AdjustmentCard
                                    kind="increase"
                                    title="Acréscimo embutido"
                                    description="Infla o m² no PDF sem mostrar uma linha separada."
                                    amount={hiddenIncreaseAmount}
                                    tone="blue"
                                />
                                <AdjustmentCard
                                    kind="discount"
                                    title="Desconto final"
                                    description="Aplica desconto depois do acréscimo embutido."
                                    amount={finalDiscountAmount}
                                    tone="emerald"
                                />

                                {totals.totalItemDiscount > 0 && (
                                    <div className="flex items-center justify-between px-1 text-sm text-red-500 dark:text-red-400">
                                        <span>Descontos nos itens</span>
                                        <span className="font-bold">-{formatNumberBR(totals.totalItemDiscount)}</span>
                                    </div>
                                )}
                            </div>

                            <div className="border-t-2 border-slate-100 pt-6 dark:border-slate-800">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Total Final</span>
                                        <span className="text-xs text-slate-400 dark:text-slate-500">Valor total do orçamento</span>
                                    </div>
                                    <span className="text-right text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                                        {formatNumberBR(totals.finalTotal)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
            <style>{`
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
