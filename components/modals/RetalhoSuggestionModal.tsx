import React, { useEffect, useState } from 'react';
import { Drawer } from 'vaul';
import { Check, ChevronDown, ChevronUp, MapPin, PackageCheck, QrCode, Ruler, X } from 'lucide-react';
import { Measurement, Retalho } from '../../types';
import { calculateAreaM2FromCentimeters, formatMetersFromCentimeters } from '../../src/lib/estoqueDimensions';
import {
    MIN_RESTOCKABLE_RETALHO_LENGTH_CM,
    RetalhoConsumptionPlan,
    RetalhoCutOrientation,
    getRetalhoConsumptionPlans
} from '../../src/lib/retalhoConsumption';

interface RetalhoSuggestionModalProps {
    isOpen: boolean;
    measurement: Measurement | null;
    retalhos: Retalho[];
    loading?: boolean;
    consumingRetalhoId?: number | null;
    onClose: () => void;
    onConfirm: (retalho: Retalho, plan: RetalhoConsumptionPlan) => void;
}

type PendingChoice = { retalho: Retalho; plan: RetalhoConsumptionPlan } | null;

const formatMeasurementValue = (value?: string | number) => String(value || '').replace('.', ',');
const formatArea = (retalho: Retalho) => calculateAreaM2FromCentimeters(retalho.larguraCm, retalho.comprimentoCm).toFixed(2).replace('.', ',');

const RetalhoSuggestionModal: React.FC<RetalhoSuggestionModalProps> = ({
    isOpen,
    measurement,
    retalhos,
    loading = false,
    consumingRetalhoId = null,
    onClose,
    onConfirm
}) => {
    const [showOtherOptions, setShowOtherOptions] = useState(false);
    const [expandedDetailsId, setExpandedDetailsId] = useState<number | null>(null);
    const [selectedOrientations, setSelectedOrientations] = useState<Record<number, RetalhoCutOrientation>>({});
    const [pendingChoice, setPendingChoice] = useState<PendingChoice>(null);

    useEffect(() => {
        if (isOpen) {
            setShowOtherOptions(false);
            setExpandedDetailsId(null);
            setSelectedOrientations({});
            setPendingChoice(null);
        }
    }, [isOpen, measurement?.id]);

    if (!isOpen || !measurement) return null;

    const measurementLabel = `${formatMeasurementValue(measurement.largura)} × ${formatMeasurementValue(measurement.altura)} m`;
    const quantity = Math.max(1, Number(measurement.quantidade) || 1);
    const pendingCount = Math.max(0, quantity - 1);
    const isConsuming = consumingRetalhoId !== null;

    const renderOutcome = (retalho: Retalho, plan: RetalhoConsumptionPlan) => {
        const exactFit = retalho.larguraCm === plan.appliedWidthCm && retalho.comprimentoCm === plan.appliedLengthCm;
        if (exactFit) return <><Check className="h-4 w-4" aria-hidden="true" /> Encaixe exato, sem sobra</>;
        if (plan.hasReusableLeftover) {
            return <>Nova sobra: {formatMetersFromCentimeters(plan.leftoverWidthCm)} × {formatMetersFromCentimeters(plan.leftoverLengthCm)} m</>;
        }
        return <>Sem sobra aproveitável: restante menor que {formatMetersFromCentimeters(MIN_RESTOCKABLE_RETALHO_LENGTH_CM)} m</>;
    };

    const renderRetalho = (retalho: Retalho, recommended = false) => {
        const plans = getRetalhoConsumptionPlans(measurement, retalho);
        if (!plans.length || !retalho.id) return null;
        const selectedOrientation = selectedOrientations[retalho.id] || plans[0].orientation;
        const selectedPlan = plans.find(plan => plan.orientation === selectedOrientation) || plans[0];
        const detailsOpen = expandedDetailsId === retalho.id;

        return (
            <article
                key={retalho.id}
                className={`overflow-hidden rounded-[20px] border bg-slate-900 shadow-lg shadow-black/20 ${recommended ? 'border-blue-500/60 ring-1 ring-blue-500/20' : 'border-slate-700/70'}`}
            >
                <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-[16px] font-bold text-white">Retalho #{retalho.id}</h3>
                                {recommended ? <span className="rounded-full bg-blue-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-300">Recomendado</span> : null}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-400">
                                <span className="inline-flex items-center gap-1.5"><Ruler className="h-3.5 w-3.5" />{formatMetersFromCentimeters(retalho.larguraCm)} × {formatMetersFromCentimeters(retalho.comprimentoCm)} m</span>
                                <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{retalho.localizacao || 'Local não informado'}</span>
                            </div>
                        </div>
                    </div>

                    {plans.length > 1 ? (
                        <div className="mt-4 grid grid-cols-2 rounded-xl border border-slate-700 bg-slate-950 p-1">
                            {plans.map(plan => (
                                <button
                                    key={plan.orientation}
                                    type="button"
                                    onClick={() => setSelectedOrientations(current => ({ ...current, [retalho.id!]: plan.orientation }))}
                                    className={`h-9 rounded-lg text-[11px] font-semibold transition-colors ${selectedPlan.orientation === plan.orientation ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
                                >
                                    {plan.orientationLabel}
                                </button>
                            ))}
                        </div>
                    ) : null}

                    <div className={`mt-4 flex items-center gap-2 rounded-xl px-3 py-3 text-[12px] font-medium ${selectedPlan.hasReusableLeftover ? 'bg-blue-500/10 text-blue-200' : 'bg-emerald-500/10 text-emerald-200'}`}>
                        {renderOutcome(retalho, selectedPlan)}
                    </div>

                    <button
                        type="button"
                        onClick={() => setExpandedDetailsId(detailsOpen ? null : retalho.id!)}
                        className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400"
                        aria-expanded={detailsOpen}
                    >
                        {detailsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {detailsOpen ? 'Ocultar detalhes' : 'Ver detalhes'}
                    </button>

                    {detailsOpen ? (
                        <div className="mt-3 grid gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-[11px] text-slate-400 sm:grid-cols-2">
                            <span>Área: <strong className="text-slate-200">{formatArea(retalho)} m²</strong></span>
                            <span className="inline-flex min-w-0 items-center gap-1.5"><QrCode className="h-3.5 w-3.5 shrink-0" /> <strong className="truncate text-slate-200">{retalho.codigoQr}</strong></span>
                            <span>Aplicação: <strong className="text-slate-200">{formatMetersFromCentimeters(selectedPlan.appliedWidthCm)} × {formatMetersFromCentimeters(selectedPlan.appliedLengthCm)} m</strong></span>
                        </div>
                    ) : null}

                    <button
                        type="button"
                        onClick={() => setPendingChoice({ retalho, plan: selectedPlan })}
                        disabled={isConsuming}
                        className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-[14px] font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60"
                    >
                        Usar retalho #{retalho.id} em 1 peça
                    </button>
                </div>
            </article>
        );
    };

    return (
        <Drawer.Root open={isOpen} onOpenChange={(open) => !open && !isConsuming && onClose()}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-[10050] bg-slate-950/70 backdrop-blur-md" />
                <Drawer.Content className="fixed inset-x-0 bottom-0 z-[10051] flex max-h-[92vh] flex-col rounded-t-[24px] border-t border-slate-700/80 bg-slate-950 outline-none sm:left-1/2 sm:max-h-[88vh] sm:w-[min(760px,calc(100vw-32px))] sm:-translate-x-1/2 sm:rounded-[24px] sm:border">
                    <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-slate-700" />
                    <div className="overflow-y-auto px-4 pb-6 pt-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}>
                        <div className="mx-auto max-w-xl">
                            {pendingChoice ? (
                                <div>
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-blue-400">Confirmar consumo</p>
                                            <Drawer.Title className="mt-1.5 text-[20px] font-bold text-white">Usar retalho #{pendingChoice.retalho.id}?</Drawer.Title>
                                            <Drawer.Description className="mt-2 text-[13px] leading-5 text-slate-400">Confira o impacto antes de atualizar o estoque.</Drawer.Description>
                                        </div>
                                        <button type="button" onClick={() => !isConsuming && setPendingChoice(null)} disabled={isConsuming} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-slate-400" aria-label="Voltar para os retalhos"><X className="h-5 w-5" /></button>
                                    </div>

                                    <div className="mt-5 space-y-2 rounded-[20px] border border-slate-700 bg-slate-900 p-4">
                                        <div className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300"><Ruler className="h-4 w-4" /></span><div><p className="text-[13px] font-semibold text-white">Aplicar em 1 de {quantity} {quantity === 1 ? 'peça' : 'peças'}</p><p className="mt-1 text-[11px] text-slate-400">Medida {measurementLabel}{pendingCount ? ` · ${pendingCount} ${pendingCount === 1 ? 'peça continuará' : 'peças continuarão'} pendente${pendingCount === 1 ? '' : 's'}.` : ''}</p></div></div>
                                        <div className="flex gap-3 border-t border-slate-800 pt-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300"><PackageCheck className="h-4 w-4" /></span><div><p className="text-[13px] font-semibold text-white">O retalho atual será marcado como usado</p><p className="mt-1 text-[11px] text-slate-400">{pendingChoice.plan.hasReusableLeftover ? `Uma nova sobra de ${formatMetersFromCentimeters(pendingChoice.plan.leftoverWidthCm)} × ${formatMetersFromCentimeters(pendingChoice.plan.leftoverLengthCm)} m será criada automaticamente.` : 'Nenhuma nova sobra aproveitável será criada.'}</p></div></div>
                                    </div>

                                    <div className="mt-5 grid grid-cols-[.8fr_1.2fr] gap-2.5">
                                        <button type="button" onClick={() => setPendingChoice(null)} disabled={isConsuming} className="h-12 rounded-xl border border-slate-700 text-[13px] font-semibold text-slate-300 disabled:opacity-50">Voltar</button>
                                        <button type="button" onClick={() => onConfirm(pendingChoice.retalho, pendingChoice.plan)} disabled={isConsuming} className="h-12 rounded-xl bg-blue-600 text-[13px] font-semibold text-white disabled:cursor-wait disabled:opacity-60">{isConsuming ? 'Atualizando estoque...' : 'Confirmar uso'}</button>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <header className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-blue-400">Estoque de retalhos</p>
                                            <Drawer.Title className="mt-1.5 text-[19px] font-bold leading-tight text-white">Melhor opção para {quantity === 1 ? 'esta peça' : `1 das ${quantity} peças`}</Drawer.Title>
                                            <Drawer.Description className="mt-2 text-[12px] leading-5 text-slate-400">{measurement.pelicula || 'Película não definida'} · {measurementLabel}</Drawer.Description>
                                        </div>
                                        <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-slate-400" aria-label="Fechar sugestões de retalhos"><X className="h-5 w-5" /></button>
                                    </header>

                                    {quantity > 1 ? <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2.5 text-[11px] leading-5 text-blue-200">A escolha abaixo atende somente 1 peça. Depois, você poderá escolher material para as outras {pendingCount}.</div> : null}

                                    <main className="mt-5">
                                        {loading ? (
                                            <div className="rounded-[20px] border border-slate-700 bg-slate-900 px-5 py-12 text-center"><i className="fas fa-spinner fa-spin text-xl text-blue-300" /><p className="mt-4 text-[13px] font-semibold text-white">Buscando o melhor retalho...</p></div>
                                        ) : !retalhos.length ? (
                                            <div className="rounded-[20px] border border-dashed border-slate-700 bg-slate-900 px-5 py-12 text-center"><p className="text-[14px] font-semibold text-white">Nenhum retalho compatível</p><p className="mt-2 text-[12px] leading-5 text-slate-400">É necessário ter a mesma película e medida suficiente para esta peça.</p></div>
                                        ) : (
                                            <div className="space-y-3">
                                                {renderRetalho(retalhos[0], true)}
                                                {retalhos.length > 1 ? (
                                                    <button type="button" onClick={() => setShowOtherOptions(current => !current)} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 text-[12px] font-semibold text-slate-300" aria-expanded={showOtherOptions}>
                                                        {showOtherOptions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                        {showOtherOptions ? 'Ocultar outras opções' : `Ver outros ${retalhos.length - 1} ${retalhos.length - 1 === 1 ? 'retalho' : 'retalhos'}`}
                                                    </button>
                                                ) : null}
                                                {showOtherOptions ? <div className="space-y-3">{retalhos.slice(1).map(retalho => renderRetalho(retalho))}</div> : null}
                                            </div>
                                        )}
                                    </main>
                                </div>
                            )}
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
};

export default RetalhoSuggestionModal;
