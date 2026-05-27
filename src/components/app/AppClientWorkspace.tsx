import React, { ReactNode } from 'react';
import ClientBar from '../../../components/ClientBar';
import ProposalOptionsCarousel from '../../../components/ProposalOptionsCarousel';
import SummaryBar from '../../../components/SummaryBar';
import ActionsBar from '../../../components/ActionsBar';
import MobileFooter from '../../../components/MobileFooter';
import CuttingOptimizationPanel from '../../../components/CuttingOptimizationPanel';
import { Client, Film, ProposalDiscount, ProposalOption, Totals, UIMeasurement } from '../../../types';
import {
    getProposalAdjustmentInputs,
    normalizeAdjustmentInputValue,
    updateProposalAdjustmentInput,
} from '../../lib/proposalAdjustments';
import {
    BadgeCheck,
    CheckCircle2,
    CircleDollarSign,
    ClipboardCheck,
    Copy,
    FileText,
    Gauge,
    Loader2,
    MinusCircle,
    PackageCheck,
    Percent,
    Plus,
    PlusCircle,
    Ruler,
    Sparkles,
    TrendingUp,
    UserRound,
} from 'lucide-react';

interface AppClientWorkspaceProps {
    clientsCount: number;
    selectedClient: Client | null;
    clientTransitionKey: number;
    proposalOptions: ProposalOption[];
    activeOptionId: number | null;
    selectedClientId: number | null;
    measurements: UIMeasurement[];
    films: Film[];
    totals: Totals;
    generalDiscount: ProposalDiscount;
    content: ReactNode;
    isGeneratingPdf: boolean;
    onSelectClientClick: () => void;
    onAddClient: () => void;
    onAddClientAI: () => void;
    onOpenAIQuickProposal: () => void;
    onEditClient: () => void;
    onDeleteClient: () => void;
    onSwipeLeft: () => void;
    onSwipeRight: () => void;
    onSelectOption: (optionId: number) => void;
    onRenameOption: (optionId: number, newName: string) => void;
    onDeleteOption: (optionId: number) => void;
    onAddOption: () => void;
    onSelectPricingMode: (pricingMode: 'complete' | 'labor_only') => void;
    onOpenProposalPaymentConfig: () => void;
    onOpenProposalExpenses: () => void;
    hasCustomProposalPaymentConfig: boolean;
    hasActiveExpenses: boolean;
    onSwipeDirectionChange: (direction: 'left' | 'right' | null, distance: number) => void;
    onOpenGeneralDiscountModal: () => void;
    onUpdateGeneralDiscount: (discount: ProposalDiscount) => void;
    onAddMeasurement: () => void;
    onDuplicateMeasurements: () => void;
    onGeneratePdf: () => void;
    onOpenAIModal: () => void;
}

const formatCurrencyBR = (value: number) => new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
}).format(value || 0);

const formatAreaBR = (value: number) => `${(value || 0).toFixed(2).replace('.', ',')} m2`;

interface ProposalCommandCenterProps {
    selectedClient: Client | null;
    measurements: UIMeasurement[];
    totals: Totals;
    generalDiscount: ProposalDiscount;
    isGeneratingPdf: boolean;
    onUpdateGeneralDiscount: (discount: ProposalDiscount) => void;
    onAddMeasurement: () => void;
    onDuplicateMeasurements: () => void;
    onGeneratePdf: () => void;
    onOpenAIModal: () => void;
}

interface GeneralDiscountInlineControlProps {
    totals: Totals;
    generalDiscount: ProposalDiscount;
    onUpdateGeneralDiscount: (discount: ProposalDiscount) => void;
}

const GeneralDiscountInlineControl: React.FC<GeneralDiscountInlineControlProps> = ({
    totals,
    generalDiscount,
    onUpdateGeneralDiscount,
}) => {
    const adjustmentInputs = getProposalAdjustmentInputs(generalDiscount);
    const finalDiscountAmount = totals.generalFinalDiscountAmount || 0;
    const hiddenIncreaseAmount = totals.generalIncreaseAmount || 0;

    const updateAdjustment = (
        kind: 'discount' | 'increase',
        input: Partial<{ value: string; type: 'percentage' | 'fixed' }>
    ) => {
        onUpdateGeneralDiscount(updateProposalAdjustmentInput(generalDiscount, kind, input));
    };
    return (
        <div className="mt-4 rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] p-2.5 shadow-[var(--shadow-hairline)]">
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-soft)]">Ajuste geral</span>
                {(hiddenIncreaseAmount > 0 || finalDiscountAmount > 0) && (
                    <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-xs font-bold text-[var(--text-muted)]">
                        +{formatCurrencyBR(hiddenIncreaseAmount)} / -{formatCurrencyBR(finalDiscountAmount)}
                    </span>
                )}
            </div>
            <div className="grid gap-2">
                <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-2">
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <div>
                            <div className="flex items-center gap-1.5 text-xs font-black text-[var(--text-strong)]">
                                <PlusCircle className="h-3.5 w-3.5 text-blue-500" aria-hidden="true" />
                                <span>Acréscimo embutido</span>
                            </div>
                            <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-soft)]">Infla o m² no PDF sem mostrar acréscimo separado.</p>
                        </div>
                        {hiddenIncreaseAmount > 0 && (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                                +{formatCurrencyBR(hiddenIncreaseAmount)}
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => updateAdjustment('increase', { type: adjustmentInputs.increase.type === 'percentage' ? 'fixed' : 'percentage' })}
                            className="flex h-10 min-w-16 items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-slate-950 px-2 text-sm font-bold text-white transition-all hover:bg-slate-800 active:scale-[0.99] dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
                            aria-label="Alternar acréscimo embutido"
                        >
                            {adjustmentInputs.increase.type === 'percentage' ? <Percent className="h-4 w-4" aria-hidden="true" /> : <CircleDollarSign className="h-4 w-4" aria-hidden="true" />}
                            <span>{adjustmentInputs.increase.type === 'percentage' ? '%' : 'R$'}</span>
                        </button>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={adjustmentInputs.increase.value}
                            onChange={(event) => updateAdjustment('increase', { value: normalizeAdjustmentInputValue(event.target.value) })}
                            placeholder={adjustmentInputs.increase.type === 'percentage' ? '0' : '0,00'}
                            className="h-10 min-w-0 flex-1 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-right text-base font-bold text-[var(--text-strong)] outline-none transition focus:border-[var(--brand-primary)] focus:bg-[var(--surface)] focus:ring-4 focus:ring-blue-500/10"
                            aria-label="Valor do acréscimo embutido"
                        />
                    </div>
                </div>
                <div className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-2">
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <div>
                            <div className="flex items-center gap-1.5 text-xs font-black text-[var(--text-strong)]">
                                <MinusCircle className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                                <span>Desconto final</span>
                            </div>
                            <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-soft)]">Aparece no fechamento depois do acréscimo embutido.</p>
                        </div>
                        {finalDiscountAmount > 0 && (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                                -{formatCurrencyBR(finalDiscountAmount)}
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => updateAdjustment('discount', { type: adjustmentInputs.discount.type === 'percentage' ? 'fixed' : 'percentage' })}
                            className="flex h-10 min-w-16 items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-slate-950 px-2 text-sm font-bold text-white transition-all hover:bg-slate-800 active:scale-[0.99] dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
                            aria-label="Alternar desconto final"
                        >
                            {adjustmentInputs.discount.type === 'percentage' ? <Percent className="h-4 w-4" aria-hidden="true" /> : <CircleDollarSign className="h-4 w-4" aria-hidden="true" />}
                            <span>{adjustmentInputs.discount.type === 'percentage' ? '%' : 'R$'}</span>
                        </button>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={adjustmentInputs.discount.value}
                            onChange={(event) => updateAdjustment('discount', { value: normalizeAdjustmentInputValue(event.target.value) })}
                            placeholder={adjustmentInputs.discount.type === 'percentage' ? '0' : '0,00'}
                            className="h-10 min-w-0 flex-1 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-right text-base font-bold text-[var(--text-strong)] outline-none transition focus:border-[var(--brand-primary)] focus:bg-[var(--surface)] focus:ring-4 focus:ring-blue-500/10"
                            aria-label="Valor do desconto final"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

const ProposalCommandCenter: React.FC<ProposalCommandCenterProps> = ({
    selectedClient,
    measurements,
    totals,
    generalDiscount,
    isGeneratingPdf,
    onUpdateGeneralDiscount,
    onAddMeasurement,
    onDuplicateMeasurements,
    onGeneratePdf,
    onOpenAIModal,
}) => {
    const activeMeasurements = measurements.filter(measurement => measurement.active !== false);
    const measurementsWithFilm = activeMeasurements.filter(measurement => Boolean(measurement.pelicula && measurement.pelicula !== 'Nenhuma'));
    const missingFilms = Math.max(activeMeasurements.length - measurementsWithFilm.length, 0);
    const hasCostBase = (totals.estimatedTotalCost || 0) > 0 || (totals.operationalExpenses || 0) > 0;
    const estimatedProfit = totals.estimatedProfit || 0;
    const estimatedMargin = totals.estimatedMarginPercentage || 0;
    const marginTone = !hasCostBase
        ? 'text-[var(--text-muted)]'
        : estimatedProfit >= 0
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-red-600 dark:text-red-400';

    const readinessItems = [
        {
            label: 'Cliente',
            value: selectedClient?.nome || 'Pendente',
            ready: Boolean(selectedClient),
            icon: <UserRound className="h-4 w-4" aria-hidden="true" />,
        },
        {
            label: 'Medidas',
            value: measurements.length > 0 ? `${measurements.length} grupo${measurements.length > 1 ? 's' : ''}` : 'Adicionar',
            ready: measurements.length > 0,
            icon: <Ruler className="h-4 w-4" aria-hidden="true" />,
        },
        {
            label: 'Películas',
            value: missingFilms === 0 && activeMeasurements.length > 0 ? 'Definidas' : `${missingFilms || activeMeasurements.length || 0} pendente${(missingFilms || activeMeasurements.length || 0) === 1 ? '' : 's'}`,
            ready: activeMeasurements.length > 0 && missingFilms === 0,
            icon: <PackageCheck className="h-4 w-4" aria-hidden="true" />,
        },
        {
            label: 'Custos',
            value: hasCostBase ? 'Calculados' : 'Sem gastos',
            ready: hasCostBase,
            icon: <CircleDollarSign className="h-4 w-4" aria-hidden="true" />,
        },
    ];

    return (
        <aside className="sticky top-28 rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-soft)]">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="ui-kicker">Centro comercial</p>
                    <h2 className="mt-1 text-xl font-bold leading-tight text-[var(--text-strong)]">Proposta ativa</h2>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Em atendimento
                </span>
            </div>

            <div className="mt-4 border-y border-[var(--border-subtle)] py-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-soft)]">Total da proposta</p>
                <p className="mt-1 text-3xl font-black tracking-tight text-[var(--text-strong)]">
                    {formatCurrencyBR(totals.finalTotal)}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div>
                        <div className="flex items-center gap-2 text-[var(--text-muted)]">
                            <Ruler className="h-4 w-4" aria-hidden="true" />
                            <span>Area</span>
                        </div>
                        <p className="mt-1 font-bold text-[var(--text-strong)]">{formatAreaBR(totals.totalM2)}</p>
                    </div>
                    <div>
                        <div className="flex items-center gap-2 text-[var(--text-muted)]">
                            <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                            <span>Pecas</span>
                        </div>
                        <p className="mt-1 font-bold text-[var(--text-strong)]">{totals.totalQuantity || 0}</p>
                    </div>
                    <div>
                        <div className="flex items-center gap-2 text-[var(--text-muted)]">
                            <Gauge className="h-4 w-4" aria-hidden="true" />
                            <span>Gastos</span>
                        </div>
                        <p className="mt-1 font-bold text-[var(--text-strong)]">{formatCurrencyBR(totals.operationalExpenses || 0)}</p>
                    </div>
                    <div>
                        <div className="flex items-center gap-2 text-[var(--text-muted)]">
                            <TrendingUp className="h-4 w-4" aria-hidden="true" />
                            <span>Margem</span>
                        </div>
                        <p className={`mt-1 font-bold ${marginTone}`}>
                            {hasCostBase ? `${estimatedMargin.toFixed(1).replace('.', ',')}%` : 'Aguardando'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-soft)]">Prontidao</p>
                    <FileText className="h-4 w-4 text-[var(--text-soft)]" aria-hidden="true" />
                </div>
                {readinessItems.map(item => (
                    <div key={item.label} className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] py-2 last:border-b-0">
                        <div className="flex min-w-0 items-center gap-2">
                            <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] ${item.ready ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-[var(--surface-muted)] text-[var(--text-muted)]'}`}>
                                {item.ready ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : item.icon}
                            </span>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-[var(--text-strong)]">{item.label}</p>
                                <p className="truncate text-xs text-[var(--text-muted)]">{item.value}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <GeneralDiscountInlineControl
                totals={totals}
                generalDiscount={generalDiscount}
                onUpdateGeneralDiscount={onUpdateGeneralDiscount}
            />

            <div className="mt-3 space-y-2">
                <button
                    onClick={onAddMeasurement}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-slate-950 font-semibold text-white shadow-[0_12px_24px_rgba(15,23,42,0.16)] transition-all hover:bg-slate-800 active:scale-[0.99] dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
                >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span>Adicionar Medida</span>
                </button>
                <button
                    onClick={onGeneratePdf}
                    disabled={isGeneratingPdf}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-emerald-600 font-semibold text-white shadow-[0_12px_24px_rgba(5,150,105,0.18)] transition-all hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-wait disabled:opacity-70"
                >
                    {isGeneratingPdf ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            <span>Gerando...</span>
                        </>
                    ) : (
                        <>
                            <FileText className="h-4 w-4" aria-hidden="true" />
                            <span>Gerar PDF</span>
                        </>
                    )}
                </button>
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={onOpenAIModal}
                        className="flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-blue-100 bg-blue-50 text-sm font-semibold text-blue-700 shadow-[var(--shadow-hairline)] transition-all hover:bg-blue-100 active:scale-[0.99] dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300"
                    >
                        <Sparkles className="h-4 w-4" aria-hidden="true" />
                        <span>Com IA</span>
                    </button>
                    <button
                        onClick={onDuplicateMeasurements}
                        className="flex h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] text-sm font-semibold text-[var(--text-body)] shadow-[var(--shadow-hairline)] transition-all hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)] active:scale-[0.99]"
                    >
                        <Copy className="h-4 w-4" aria-hidden="true" />
                        <span>Duplicar</span>
                    </button>
                </div>
            </div>
        </aside>
    );
};

export const AppClientWorkspace: React.FC<AppClientWorkspaceProps> = ({
    clientsCount,
    selectedClient,
    clientTransitionKey,
    proposalOptions,
    activeOptionId,
    selectedClientId,
    measurements,
    films,
    totals,
    generalDiscount,
    content,
    isGeneratingPdf,
    onSelectClientClick,
    onAddClient,
    onAddClientAI,
    onOpenAIQuickProposal,
    onEditClient,
    onDeleteClient,
    onSwipeLeft,
    onSwipeRight,
    onSelectOption,
    onRenameOption,
    onDeleteOption,
    onAddOption,
    onSelectPricingMode,
    onOpenProposalPaymentConfig,
    onOpenProposalExpenses,
    hasCustomProposalPaymentConfig,
    hasActiveExpenses,
    onSwipeDirectionChange,
    onOpenGeneralDiscountModal,
    onUpdateGeneralDiscount,
    onAddMeasurement,
    onDuplicateMeasurements,
    onGeneratePdf,
    onOpenAIModal
}) => {
    if (clientsCount === 0) {
        return (
            <div id="contentContainer" className="w-full min-h-[300px] animate-fade-in">
                {content}
            </div>
        );
    }

    const hasDesktopCommandCenter = Boolean(selectedClientId);

    return (
        <>
            <section className={hasDesktopCommandCenter ? 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_400px] lg:items-start' : 'space-y-4 sm:space-y-5'}>
                <div className="min-w-0 space-y-4 sm:space-y-5">
                    <div className="relative z-20">
                        <ClientBar
                            key={clientTransitionKey}
                            selectedClient={selectedClient}
                            onSelectClientClick={onSelectClientClick}
                            onAddClient={onAddClient}
                            onAddClientAI={onAddClientAI}
                            onQuickProposalAI={onOpenAIQuickProposal}
                            onEditClient={onEditClient}
                            onDeleteClient={onDeleteClient}
                            onSwipeLeft={onSwipeLeft}
                            onSwipeRight={onSwipeRight}
                        />
                    </div>

                    {proposalOptions.length > 0 && activeOptionId && (
                        <>
                            <div className={measurements.length > 0 ? 'hidden sm:block' : undefined}>
                                <ProposalOptionsCarousel
                                    options={proposalOptions}
                                    activeOptionId={activeOptionId}
                                    onSelectOption={onSelectOption}
                                    onRenameOption={onRenameOption}
                                    onDeleteOption={onDeleteOption}
                                    onAddOption={onAddOption}
                                    onSelectPricingMode={onSelectPricingMode}
                                    onOpenPaymentConfig={onOpenProposalPaymentConfig}
                                    onOpenExpenses={onOpenProposalExpenses}
                                    hasActivePaymentOverride={hasCustomProposalPaymentConfig}
                                    hasActiveExpenses={hasActiveExpenses}
                                    onSwipeDirectionChange={onSwipeDirectionChange}
                                />
                            </div>

                            {measurements.length > 0 && (
                                <div className="sm:hidden">
                                    <ProposalOptionsCarousel
                                        options={proposalOptions}
                                        activeOptionId={activeOptionId}
                                        onSelectOption={onSelectOption}
                                        onRenameOption={onRenameOption}
                                        onDeleteOption={onDeleteOption}
                                        onAddOption={onAddOption}
                                        onSelectPricingMode={onSelectPricingMode}
                                        onOpenPaymentConfig={onOpenProposalPaymentConfig}
                                        onOpenExpenses={onOpenProposalExpenses}
                                        hasActivePaymentOverride={hasCustomProposalPaymentConfig}
                                        hasActiveExpenses={hasActiveExpenses}
                                        onSwipeDirectionChange={onSwipeDirectionChange}
                                        showOptionsStrip={false}
                                    />
                                </div>
                            )}
                        </>
                    )}

                    <div id="contentContainer" className="w-full min-h-[300px] animate-fade-in pb-28 sm:pb-0">
                        {content}

                        {measurements.length > 0 && selectedClientId && (
                            <div className="mt-4 mb-4 sm:mb-0">
                                <CuttingOptimizationPanel
                                    measurements={measurements}
                                    clientId={selectedClientId ?? undefined}
                                    optionId={activeOptionId ?? undefined}
                                    films={films}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {hasDesktopCommandCenter && (
                    <div className="hidden lg:block">
                        <ProposalCommandCenter
                            selectedClient={selectedClient}
                            measurements={measurements}
                            totals={totals}
                            generalDiscount={generalDiscount}
                            isGeneratingPdf={isGeneratingPdf}
                            onUpdateGeneralDiscount={onUpdateGeneralDiscount}
                            onAddMeasurement={onAddMeasurement}
                            onDuplicateMeasurements={onDuplicateMeasurements}
                            onGeneratePdf={onGeneratePdf}
                            onOpenAIModal={onOpenAIModal}
                        />
                    </div>
                )}
            </section>

            {selectedClientId && (
                <>
                    <div className="hidden sm:block lg:hidden mt-5 rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-soft)]">
                        <SummaryBar
                            totals={totals}
                            generalDiscount={generalDiscount}
                            onOpenGeneralDiscountModal={onOpenGeneralDiscountModal}
                            isDesktop
                        />
                        <ActionsBar
                            onAddMeasurement={onAddMeasurement}
                            onDuplicateMeasurements={onDuplicateMeasurements}
                            onGeneratePdf={onGeneratePdf}
                            isGeneratingPdf={isGeneratingPdf}
                            onOpenAIModal={onOpenAIModal}
                        />
                    </div>

                    <MobileFooter
                        totals={totals}
                        generalDiscount={generalDiscount}
                        onOpenGeneralDiscountModal={onOpenGeneralDiscountModal}
                        onUpdateGeneralDiscount={onUpdateGeneralDiscount}
                        onAddMeasurement={onAddMeasurement}
                        onDuplicateMeasurements={onDuplicateMeasurements}
                        onGeneratePdf={onGeneratePdf}
                        isGeneratingPdf={isGeneratingPdf}
                        onOpenAIModal={onOpenAIModal}
                    />
                </>
            )}
        </>
    );
};
