import React, { useEffect, useRef, useState } from 'react';
import { Drawer } from 'vaul';
import { CircleDollarSign, Eye, EyeOff, MinusCircle, Percent, PlusCircle, Shield, ShieldCheck } from 'lucide-react';

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
    onGeneratePdf: () => void;
    isGeneratingPdf: boolean;
    defaultHideMeasurements?: boolean;
    defaultIncluirTermo?: boolean;
    /** Opções/oportunidades da proposta — habilita o swipe entre elas no mobile. */
    options?: { id: number; name: string }[];
    activeOptionId?: number | null;
    onSelectOption?: (optionId: number) => void;
}

const formatNumberBR = (number: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(number);
};

interface AdjustmentInputState {
    value: string;
    type: 'percentage' | 'fixed';
}

interface AdjustmentCardProps {
    kind: 'discount' | 'increase';
    title: string;
    description: string;
    amount: number;
    tone: 'blue' | 'emerald';
    input: AdjustmentInputState;
    onUpdate: (input: Partial<AdjustmentInputState>) => void;
}

// Definido no nível do módulo (e não dentro de TotalsDrawer) para manter uma
// identidade de componente estável. Se ficasse aninhado, cada digitação
// recriaria a função, remontaria o <input> e fecharia o teclado no celular.
const AdjustmentCard: React.FC<AdjustmentCardProps> = ({
    kind,
    title,
    description,
    amount,
    tone,
    input,
    onUpdate,
}) => {
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
                    onClick={() => onUpdate({ type: isPercentage ? 'fixed' : 'percentage' })}
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
                    onChange={(event) => onUpdate({ value: normalizeAdjustmentInputValue(event.target.value) })}
                    placeholder={isPercentage ? '0' : '0,00'}
                    className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-right text-lg font-bold text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
            </div>
        </div>
    );
};

export const TotalsDrawer: React.FC<TotalsDrawerProps> = ({
    isOpen,
    onClose,
    totals,
    generalDiscount,
    onUpdateGeneralDiscount,
    onGeneratePdf,
    isGeneratingPdf,
    defaultHideMeasurements = false,
    defaultIncluirTermo = true,
    options = [],
    activeOptionId = null,
    onSelectOption
}) => {
    const [openGroup, setOpenGroup] = useState<string | null>(null);
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);

    const hasMultipleOptions = options.length > 1 && !!onSelectOption;
    const activeOptionIndex = options.findIndex((option) => option.id === activeOptionId);

    const goToOption = (direction: -1 | 1) => {
        if (!hasMultipleOptions || activeOptionIndex < 0) return;
        const nextIndex = activeOptionIndex + direction;
        if (nextIndex < 0 || nextIndex >= options.length) return;
        onSelectOption?.(options[nextIndex].id);
    };

    const handleTouchStart = (event: React.TouchEvent) => {
        if (!hasMultipleOptions) return;
        const touch = event.touches[0];
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchEnd = (event: React.TouchEvent) => {
        if (!hasMultipleOptions || !touchStartRef.current) return;
        const touch = event.changedTouches[0];
        const deltaX = touch.clientX - touchStartRef.current.x;
        const deltaY = touch.clientY - touchStartRef.current.y;
        touchStartRef.current = null;
        // Só reage a gestos predominantemente horizontais para não brigar com o scroll vertical.
        if (Math.abs(deltaX) < 60 || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;
        goToOption(deltaX < 0 ? 1 : -1);
    };
    const adjustmentInputs = getProposalAdjustmentInputs(generalDiscount);
    const hiddenIncreaseAmount = totals.generalIncreaseAmount || 0;
    const finalDiscountAmount = totals.generalFinalDiscountAmount || 0;

    useEffect(() => {
        if (totals.groupedTotals && Object.keys(totals.groupedTotals).length > 0 && !openGroup) {
            setOpenGroup(Object.keys(totals.groupedTotals)[0]);
        }
    }, [totals.groupedTotals, openGroup]);

    const isLaborOnly = generalDiscount.pricingMode === 'labor_only';
    const filmPricingModes = generalDiscount.filmPricingModes || {};
    // Anti-cópia: estado efetivo = override do orçamento ou o padrão global da empresa.
    const hideMeasurements = generalDiscount.hideMeasurements ?? defaultHideMeasurements;
    const toggleHideMeasurements = () => {
        onUpdateGeneralDiscount({ ...generalDiscount, hideMeasurements: !hideMeasurements });
    };
    // Termo de Responsabilidade: estado efetivo = override do orçamento ou o padrão global da empresa.
    const incluirTermo = generalDiscount.incluirTermoResponsabilidade ?? defaultIncluirTermo;
    const toggleIncluirTermo = () => {
        onUpdateGeneralDiscount({ ...generalDiscount, incluirTermoResponsabilidade: !incluirTermo });
    };

    const updateAdjustment = (
        kind: 'discount' | 'increase',
        input: Partial<{ value: string; type: 'percentage' | 'fixed' }>
    ) => {
        onUpdateGeneralDiscount(updateProposalAdjustmentInput(generalDiscount, kind, input));
    };

    const setFilmPricingMode = (filmName: string, mode: 'area' | 'linear') => {
        const next = { ...(generalDiscount.filmPricingModes || {}) };
        if (mode === 'area') {
            delete next[filmName];
        } else {
            next[filmName] = 'linear';
        }
        onUpdateGeneralDiscount({ ...generalDiscount, filmPricingModes: next });
    };

    const toggleGroup = (filmName: string) => {
        setOpenGroup(openGroup === filmName ? null : filmName);
    };

    return (
        <Drawer.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
                <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex h-[100dvh] max-h-[100dvh] flex-col border-t border-slate-200 bg-white outline-none dark:border-slate-700 dark:bg-slate-900">
                    <div
                        className="flex-1 overflow-y-auto bg-white p-4 dark:bg-slate-900"
                        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}
                        onTouchStart={handleTouchStart}
                        onTouchEnd={handleTouchEnd}
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

                            {hasMultipleOptions && (
                                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/60">
                                    <button
                                        type="button"
                                        onClick={() => goToOption(-1)}
                                        disabled={activeOptionIndex <= 0}
                                        aria-label="Oportunidade anterior"
                                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm transition-all active:scale-90 disabled:opacity-30 dark:bg-slate-900 dark:text-slate-300"
                                    >
                                        <i className="fas fa-chevron-left text-sm" />
                                    </button>
                                    <div className="flex min-w-0 flex-1 flex-col items-center">
                                        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                                            Oportunidade {activeOptionIndex + 1} de {options.length}
                                        </span>
                                        <span className="max-w-full truncate text-sm font-bold text-slate-900 dark:text-white">
                                            {activeOptionIndex >= 0 ? options[activeOptionIndex].name : '—'}
                                        </span>
                                        <div className="mt-1.5 flex items-center gap-1.5">
                                            {options.map((option, idx) => (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    onClick={() => onSelectOption?.(option.id)}
                                                    aria-label={`Ver ${option.name}`}
                                                    aria-current={idx === activeOptionIndex}
                                                    className={`h-1.5 rounded-full transition-all duration-200 ${idx === activeOptionIndex ? 'w-4 bg-blue-500' : 'w-1.5 bg-slate-300 dark:bg-slate-600'}`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => goToOption(1)}
                                        disabled={activeOptionIndex >= options.length - 1}
                                        aria-label="Próxima oportunidade"
                                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm transition-all active:scale-90 disabled:opacity-30 dark:bg-slate-900 dark:text-slate-300"
                                    >
                                        <i className="fas fa-chevron-right text-sm" />
                                    </button>
                                </div>
                            )}

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
                                                        {!isLaborOnly && (
                                                            <div className="flex items-center justify-between gap-2 pt-1">
                                                                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Cobrar por</span>
                                                                <div className="grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-900">
                                                                    {(['area', 'linear'] as const).map((mode) => {
                                                                        const active = (filmPricingModes[group.filmName] === 'linear' ? 'linear' : 'area') === mode;
                                                                        return (
                                                                            <button
                                                                                key={mode}
                                                                                type="button"
                                                                                onClick={() => setFilmPricingMode(group.filmName, mode)}
                                                                                aria-pressed={active}
                                                                                className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-all ${
                                                                                    active
                                                                                        ? 'bg-blue-600 text-white shadow dark:bg-blue-500'
                                                                                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                                                                }`}
                                                                            >
                                                                                {mode === 'area' ? 'm²' : 'metro linear'}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {group.filmPricingMode === 'linear' && (
                                                            <div className="flex items-center justify-between rounded-lg bg-blue-50 px-2 py-1.5 dark:bg-blue-900/20">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">Venda metro linear</span>
                                                                    <span className="text-[10px] font-medium text-blue-500/80 dark:text-blue-300/70">{formatNumberBR(group.unitSalePriceLinearMeter)}/m × {group.totalLinearMeters.toFixed(2)} m</span>
                                                                </div>
                                                                <span className="text-xs font-bold text-blue-700 dark:text-blue-300">{formatNumberBR(group.linearSaleSubtotal)}</span>
                                                            </div>
                                                        )}

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

                            <div className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 shadow-[var(--shadow-soft)]">
                                <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-soft)]">Resumo de Custos</h3>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-[var(--text-muted)]">Total Material</span>
                                        <span className="text-sm font-semibold text-[var(--text-strong)]">{formatNumberBR(totals.totalMaterial)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-[var(--text-muted)]">Total Mão de Obra</span>
                                        <span className="text-sm font-semibold text-[var(--text-strong)]">{formatNumberBR(totals.totalLabor)}</span>
                                    </div>
                                    {totals.linearMeterCost > 0 && (
                                        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-2">
                                            <span className="text-xs text-blue-600 dark:text-blue-400">Total Metro Linear</span>
                                            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">{formatNumberBR(totals.linearMeterCost)}</span>
                                        </div>
                                    )}
                                    {totals.operationalExpenses > 0 && (
                                        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-2">
                                            <span className="text-xs text-amber-600 dark:text-amber-300">Gastos informados</span>
                                            <span className="text-sm font-semibold text-amber-600 dark:text-amber-300">{formatNumberBR(totals.operationalExpenses)}</span>
                                        </div>
                                    )}
                                    {totals.estimatedTotalCost > 0 && (
                                        <>
                                            <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-2">
                                                <span className="text-xs text-[var(--text-muted)]">Custo estimado</span>
                                                <span className="text-sm font-semibold text-[var(--text-strong)]">{formatNumberBR(totals.estimatedTotalCost)}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-[var(--text-muted)]">Resultado estimado</span>
                                                <span className={`text-sm font-semibold ${totals.estimatedProfit >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300'}`}>
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
                                    input={adjustmentInputs.increase}
                                    onUpdate={(input) => updateAdjustment('increase', input)}
                                />
                                <AdjustmentCard
                                    kind="discount"
                                    title="Desconto final"
                                    description="Aplica desconto depois do acréscimo embutido."
                                    amount={finalDiscountAmount}
                                    tone="emerald"
                                    input={adjustmentInputs.discount}
                                    onUpdate={(input) => updateAdjustment('discount', input)}
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

                    <div
                        className="flex-shrink-0 border-t border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
                        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
                    >
                        {/* Anti-cópia: oculta dimensões e m² no PDF */}
                        <button
                            type="button"
                            onClick={toggleHideMeasurements}
                            role="switch"
                            aria-checked={hideMeasurements}
                            className={`mb-3 flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors ${hideMeasurements
                                ? 'border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30'
                                : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60'
                                }`}
                        >
                            <span className="flex items-center gap-2.5">
                                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${hideMeasurements ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}>
                                    {hideMeasurements ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Ocultar medidas no PDF</span>
                                    <span className="block text-[11px] text-slate-500">Esconde dimensões e m² (anti-cópia)</span>
                                </span>
                            </span>
                            <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${hideMeasurements ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${hideMeasurements ? 'left-[22px]' : 'left-0.5'}`} />
                            </span>
                        </button>
                        {/* Termo de Responsabilidade (integridade dos vidros) no PDF */}
                        <button
                            type="button"
                            onClick={toggleIncluirTermo}
                            role="switch"
                            aria-checked={incluirTermo}
                            className={`mb-3 flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors ${incluirTermo
                                ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30'
                                : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60'
                                }`}
                        >
                            <span className="flex items-center gap-2.5">
                                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${incluirTermo ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}>
                                    {incluirTermo ? <ShieldCheck className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Termo de responsabilidade</span>
                                    <span className="block text-[11px] text-slate-500">Isenção por quebras em vidros já fragilizados</span>
                                </span>
                            </span>
                            <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${incluirTermo ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${incluirTermo ? 'left-[22px]' : 'left-0.5'}`} />
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => { onClose(); onGeneratePdf(); }}
                            disabled={isGeneratingPdf}
                            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-60 dark:bg-blue-500"
                        >
                            <i className={`fas ${isGeneratingPdf ? 'fa-spinner fa-spin' : 'fa-file-pdf'}`} aria-hidden="true" />
                            <span>{isGeneratingPdf ? 'Gerando PDF...' : 'Salvar PDF'}</span>
                        </button>
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
