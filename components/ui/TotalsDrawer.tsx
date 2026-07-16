import React, { useEffect, useRef, useState } from 'react';
import { Drawer } from 'vaul';
import { CircleDollarSign, Eye, EyeOff, MinusCircle, Percent, PlusCircle, RotateCcw, Shield, ShieldCheck, SlidersHorizontal } from 'lucide-react';

import type { FilmPriceOverride, ProposalDiscount, Totals } from '../../types';
import {
    getProposalAdjustmentInputs,
    normalizeAdjustmentInputValue,
    updateProposalAdjustmentInput,
} from '../../src/lib/proposalAdjustments';
import type { FilmPriceField } from '../../src/lib/filmPriceOverrides';
import { resetFilmPriceOverrides, updateFilmPriceOverrides } from '../../src/lib/filmPriceOverrides';

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

interface ProposalPriceInputProps {
    label: string;
    unit: string;
    value: string | number;
    catalogValue: number;
    customized: boolean;
    onChange: (value: string) => void;
    onReset: () => void;
}

const ProposalPriceInput: React.FC<ProposalPriceInputProps> = ({
    label,
    unit,
    value,
    catalogValue,
    customized,
    onChange,
    onReset,
}) => (
    <div className={`rounded-lg border p-2 transition-colors ${customized
        ? 'border-blue-300 bg-blue-50/80 dark:border-blue-800 dark:bg-blue-950/30'
        : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/70'
    }`}>
        <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                    <span className="truncate text-[11px] font-semibold text-slate-600 dark:text-slate-300">{label}</span>
                    {customized && (
                        <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-blue-700 dark:bg-blue-900/50 dark:text-blue-200">
                            Personalizado
                        </span>
                    )}
                </div>
                <span className="mt-0.5 block text-[9px] text-slate-400">
                    {customized ? `Catálogo: ${formatNumberBR(catalogValue)}/${unit}` : 'Somente neste orçamento'}
                </span>
            </div>
            <label className="flex h-9 w-[142px] shrink-0 items-center overflow-hidden rounded-lg border border-slate-200 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950">
                <span className="pl-2.5 text-xs font-bold text-slate-400">R$</span>
                <input
                    type="text"
                    inputMode="decimal"
                    value={customized ? normalizeAdjustmentInputValue(value) : normalizeAdjustmentInputValue(catalogValue)}
                    onChange={(event) => onChange(normalizeAdjustmentInputValue(event.target.value))}
                    onBlur={(event) => { if (!event.target.value.trim()) onReset(); }}
                    aria-label={label}
                    className="h-full min-w-0 flex-1 bg-transparent px-1.5 text-right text-sm font-black text-slate-900 outline-none dark:text-white"
                />
                <span className="pr-2 text-[10px] font-semibold text-slate-400">/{unit}</span>
            </label>
            {customized && (
                <button
                    type="button"
                    onClick={onReset}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-blue-700 transition-colors hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900/40"
                    aria-label={`Restaurar ${label} do catálogo`}
                    title="Restaurar valor do catálogo"
                >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
            )}
        </div>
    </div>
);

interface FilmPricingEditorProps {
    group: any;
    isLaborOnly: boolean;
    override?: FilmPriceOverride;
    advancedOpen: boolean;
    onToggleAdvanced: () => void;
    onChange: (field: FilmPriceField, value: string | undefined) => void;
    onResetAll: () => void;
}

const FilmPricingEditor: React.FC<FilmPricingEditorProps> = ({
    group,
    isLaborOnly,
    override,
    advancedOpen,
    onToggleAdvanced,
    onChange,
    onResetAll,
}) => {
    const fields: Record<FilmPriceField, { label: string; unit: string; value: number; catalogValue: number }> = {
        preco: {
            label: 'Preço de venda por m²',
            unit: 'm²',
            value: group.unitPriceMaterial,
            catalogValue: group.catalogUnitPriceMaterial,
        },
        maoDeObra: {
            label: 'Mão de obra por m²',
            unit: 'm²',
            value: group.unitPriceLabor,
            catalogValue: group.catalogUnitPriceLabor,
        },
        precoMetroLinear: {
            label: 'Custo por metro linear',
            unit: 'm',
            value: group.unitPriceLinearMeter,
            catalogValue: group.catalogUnitPriceLinearMeter,
        },
        precoVendaMetroLinear: {
            label: 'Venda por metro linear',
            unit: 'm',
            value: group.unitSalePriceLinearMeter,
            catalogValue: group.catalogUnitSalePriceLinearMeter,
        },
    };
    const primaryField: FilmPriceField = isLaborOnly
        ? 'maoDeObra'
        : group.filmPricingMode === 'linear'
            ? 'precoVendaMetroLinear'
            : 'preco';
    const advancedFields = (Object.keys(fields) as FilmPriceField[]).filter(field => field !== primaryField);
    const hasAnyOverride = !!override && Object.keys(override).length > 0;
    const renderField = (field: FilmPriceField) => {
        const config = fields[field];
        const customized = !!override && Object.prototype.hasOwnProperty.call(override, field);
        return (
            <ProposalPriceInput
                key={field}
                label={config.label}
                unit={config.unit}
                value={customized ? override?.[field] ?? '' : config.value}
                catalogValue={config.catalogValue}
                customized={customized}
                onChange={(value) => onChange(field, value)}
                onReset={() => onChange(field, undefined)}
            />
        );
    };

    return (
        <div className="space-y-2 rounded-xl border border-blue-100 bg-blue-50/40 p-2 dark:border-blue-900/40 dark:bg-blue-950/10">
            <div className="flex items-center justify-between gap-2 px-0.5">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-slate-800 dark:text-slate-100">Preço nesta proposta</span>
                        {hasAnyOverride && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">Personalizado</span>}
                    </div>
                    <p className="mt-0.5 text-[9px] text-slate-500 dark:text-slate-400">O catálogo continua com o preço original.</p>
                </div>
                {hasAnyOverride && (
                    <button
                        type="button"
                        onClick={onResetAll}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 dark:text-blue-300"
                    >
                        <RotateCcw className="h-3 w-3" aria-hidden="true" />
                        Restaurar tudo
                    </button>
                )}
            </div>

            {renderField(primaryField)}

            <button
                type="button"
                onClick={onToggleAdvanced}
                aria-expanded={advancedOpen}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[10px] font-semibold text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-900/50"
            >
                <span className="inline-flex items-center gap-2">
                    <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                    Custos e outros preços
                </span>
                <i className={`fas fa-chevron-down text-[9px] transition-transform ${advancedOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>

            {advancedOpen && <div className="grid gap-2">{advancedFields.map(renderField)}</div>}
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
    const [advancedPriceGroup, setAdvancedPriceGroup] = useState<string | null>(null);
    const [adjustmentsOpen, setAdjustmentsOpen] = useState(false);
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
        setOpenGroup(null);
        setAdvancedPriceGroup(null);
    }, [activeOptionId]);

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

    const setFilmPrice = (filmName: string, field: FilmPriceField, value: string | undefined) => {
        onUpdateGeneralDiscount({
            ...generalDiscount,
            filmPriceOverrides: updateFilmPriceOverrides(
                generalDiscount.filmPriceOverrides,
                filmName,
                field,
                value,
            ),
        });
    };

    const resetFilmPrices = (filmName: string) => {
        onUpdateGeneralDiscount({
            ...generalDiscount,
            filmPriceOverrides: resetFilmPriceOverrides(generalDiscount.filmPriceOverrides, filmName),
        });
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
                        className="flex-1 overflow-y-auto overscroll-contain bg-white px-3 dark:bg-slate-900 sm:px-4"
                        style={{
                            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.35rem)',
                            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
                        }}
                        onTouchStart={handleTouchStart}
                        onTouchEnd={handleTouchEnd}
                    >
                        <div className="mx-auto mb-2 h-1 w-10 flex-shrink-0 rounded-full bg-slate-300 dark:bg-slate-700" />

                        <div className="mx-auto max-w-md space-y-4">
                            <div className="flex min-h-10 items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-bold leading-tight text-slate-900 dark:text-white">Resumo de Valores</h2>
                                    <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">Confira, ajuste e gere o PDF.</p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                    aria-label="Fechar"
                                >
                                    <i className="fas fa-times text-lg" />
                                </button>
                            </div>

                            {hasMultipleOptions && (
                                <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-700 dark:bg-slate-800/60">
                                    <button
                                        type="button"
                                        onClick={() => goToOption(-1)}
                                        disabled={activeOptionIndex <= 0}
                                        aria-label="Oportunidade anterior"
                                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm transition-all active:scale-90 disabled:opacity-30 dark:bg-slate-900 dark:text-slate-300"
                                    >
                                        <i className="fas fa-chevron-left text-sm" />
                                    </button>
                                    <div className="flex min-w-0 flex-1 flex-col items-center">
                                        <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                                            Opção {activeOptionIndex + 1} de {options.length}
                                        </span>
                                        <span className="max-w-full truncate text-sm font-bold text-slate-900 dark:text-white">
                                            {activeOptionIndex >= 0 ? options[activeOptionIndex].name : '—'}
                                        </span>
                                        <div className="mt-1 flex items-center gap-1">
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
                                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm transition-all active:scale-90 disabled:opacity-30 dark:bg-slate-900 dark:text-slate-300"
                                    >
                                        <i className="fas fa-chevron-right text-sm" />
                                    </button>
                                </div>
                            )}

                            <div className={`grid divide-slate-200 rounded-xl border border-slate-200 bg-slate-50 dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800/40 ${totals.totalLinearMeters > 0 ? 'grid-cols-2 divide-x' : 'grid-cols-1'}`}>
                                <div className="px-3 py-2.5">
                                    <span className="block text-[9px] font-medium uppercase tracking-[0.12em] text-slate-400">Área Total</span>
                                    <span className="mt-0.5 block text-base font-bold text-slate-900 dark:text-white">{totals.totalM2.toFixed(2)} m²</span>
                                </div>
                                {totals.totalLinearMeters > 0 && (
                                    <div className="px-3 py-2.5">
                                        <span className="block text-[9px] font-medium uppercase tracking-[0.12em] text-slate-400">Metro Linear</span>
                                        <span className="mt-0.5 block text-base font-bold text-slate-900 dark:text-white">{totals.totalLinearMeters.toFixed(2)} m</span>
                                    </div>
                                )}
                            </div>

                            {totals.groupedTotals && Object.keys(totals.groupedTotals).length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between px-1">
                                        <h3 className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">Películas e preços</h3>
                                        <span className="text-[9px] text-slate-400">Toque para editar</span>
                                    </div>
                                    <div className="space-y-2">
                                        {Object.values(totals.groupedTotals).map((group: any) => (
                                            <div
                                                key={group.filmName}
                                                className="overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-200 dark:border-slate-700 dark:bg-slate-800"
                                            >
                                                <button
                                                    onClick={() => toggleGroup(group.filmName)}
                                                    className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
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
                                                    <div className="space-y-2 border-t border-slate-100 bg-slate-50/50 p-2 dark:border-slate-700/50 dark:bg-slate-800/50">
                                                        {!isLaborOnly && (
                                                            <div className="flex items-center justify-between gap-2">
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
                                                                                className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold transition-all ${
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

                                                        <FilmPricingEditor
                                                            group={group}
                                                            isLaborOnly={isLaborOnly}
                                                            override={generalDiscount.filmPriceOverrides?.[group.filmName]}
                                                            advancedOpen={advancedPriceGroup === group.filmName}
                                                            onToggleAdvanced={() => setAdvancedPriceGroup(current => current === group.filmName ? null : group.filmName)}
                                                            onChange={(field, value) => setFilmPrice(group.filmName, field, value)}
                                                            onResetAll={() => resetFilmPrices(group.filmName)}
                                                        />

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

                            <div className="space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 shadow-[var(--shadow-soft)]">
                                <h3 className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-soft)]">Resumo de Custos</h3>
                                <div className="space-y-1.5">
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

                            <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40">
                                <button
                                    type="button"
                                    onClick={() => setAdjustmentsOpen(open => !open)}
                                    aria-expanded={adjustmentsOpen}
                                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                                >
                                    <span>
                                        <span className="block text-sm font-bold text-slate-700 dark:text-slate-200">Acréscimo e desconto</span>
                                        <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                                            {hiddenIncreaseAmount > 0 || finalDiscountAmount > 0 ? 'Existe um ajuste aplicado' : 'Opcional · toque para configurar'}
                                        </span>
                                    </span>
                                    {(hiddenIncreaseAmount > 0 || finalDiscountAmount > 0) && (
                                        <span className="ml-auto rounded-full bg-white px-2 py-1 text-[10px] font-bold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                            +{formatNumberBR(hiddenIncreaseAmount)} / -{formatNumberBR(finalDiscountAmount)}
                                        </span>
                                    )}
                                    <i className={`fas fa-chevron-down text-[10px] text-slate-400 transition-transform ${adjustmentsOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                                </button>

                                {adjustmentsOpen && (
                                    <div className="space-y-3 border-t border-slate-200 p-2.5 dark:border-slate-700">
                                        <AdjustmentCard
                                            kind="increase"
                                            title="Acréscimo embutido"
                                            description="Aumenta o valor sem criar uma linha separada no PDF."
                                            amount={hiddenIncreaseAmount}
                                            tone="blue"
                                            input={adjustmentInputs.increase}
                                            onUpdate={(input) => updateAdjustment('increase', input)}
                                        />
                                        <AdjustmentCard
                                            kind="discount"
                                            title="Desconto final"
                                            description="Aplica o desconto sobre o valor final."
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
                                )}
                            </div>

                            <div className="rounded-xl bg-slate-900 px-3 py-3 text-white dark:bg-slate-950">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total do orçamento</span>
                                        <span className="text-[9px] text-slate-500">Valor que sairá no PDF</span>
                                    </div>
                                    <span className="text-right text-2xl font-black tracking-tight text-white">
                                        {formatNumberBR(totals.finalTotal)}
                                    </span>
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/50">
                                <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-700">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Opções do PDF</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={toggleHideMeasurements}
                                    role="switch"
                                    aria-checked={hideMeasurements}
                                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                                >
                                    <span className="flex min-w-0 items-center gap-2.5">
                                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${hideMeasurements ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}>
                                            {hideMeasurements ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100">Ocultar medidas</span>
                                            <span className="block truncate text-[9px] text-slate-500">Protege dimensões e m² contra cópia</span>
                                        </span>
                                    </span>
                                    <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${hideMeasurements ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${hideMeasurements ? 'left-[18px]' : 'left-0.5'}`} />
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={toggleIncluirTermo}
                                    role="switch"
                                    aria-checked={incluirTermo}
                                    className="flex w-full items-center justify-between gap-3 border-t border-slate-100 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                                >
                                    <span className="flex min-w-0 items-center gap-2.5">
                                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${incluirTermo ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}>
                                            {incluirTermo ? <ShieldCheck className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100">Termo de responsabilidade</span>
                                            <span className="block truncate text-[9px] text-slate-500">Inclui a proteção sobre vidros fragilizados</span>
                                        </span>
                                    </span>
                                    <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${incluirTermo ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${incluirTermo ? 'left-[18px]' : 'left-0.5'}`} />
                                    </span>
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={() => { onClose(); onGeneratePdf(); }}
                                disabled={isGeneratingPdf}
                                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-bold text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-60 dark:bg-blue-500"
                            >
                                <i className={`fas ${isGeneratingPdf ? 'fa-spinner fa-spin' : 'fa-file-pdf'}`} aria-hidden="true" />
                                <span>{isGeneratingPdf ? 'Gerando PDF...' : 'Gerar e salvar PDF'}</span>
                            </button>
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
};
