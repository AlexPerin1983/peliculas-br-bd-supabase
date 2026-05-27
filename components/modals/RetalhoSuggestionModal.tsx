import React, { useEffect, useState } from 'react';
import { Drawer } from 'vaul';
import { Measurement, Retalho } from '../../types';
import { calculateAreaM2FromCentimeters, formatMetersFromCentimeters } from '../../src/lib/estoqueDimensions';
import {
    MIN_RESTOCKABLE_RETALHO_LENGTH_CM,
    RetalhoConsumptionPlan,
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

const formatMeasurementValue = (value?: string | number) => String(value || '').replace('.', ',');

const RetalhoSuggestionModal: React.FC<RetalhoSuggestionModalProps> = ({
    isOpen,
    measurement,
    retalhos,
    loading = false,
    consumingRetalhoId = null,
    onClose,
    onConfirm
}) => {
    const [isInfoExpanded, setIsInfoExpanded] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsInfoExpanded(false);
        };
    }, [isOpen, measurement?.id]);

    if (!isOpen || !measurement) {
        return null;
    }

    const measurementLabel = `${formatMeasurementValue(measurement.largura)} x ${formatMeasurementValue(measurement.altura)} m`;
    return (
        <Drawer.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-[10050] bg-slate-950/70 backdrop-blur-md" />
                <Drawer.Content
                    aria-labelledby="retalho-suggestion-modal-title"
                    className="fixed bottom-0 left-0 right-0 z-[10051] flex max-h-[92vh] flex-col rounded-t-[24px] border-t border-slate-700/80 bg-slate-950 outline-none sm:left-1/2 sm:max-h-[88vh] sm:w-[min(960px,calc(100vw-32px))] sm:-translate-x-1/2 sm:rounded-[24px] sm:border sm:border-slate-700/80"
                >
                    <div
                        className="overflow-y-auto rounded-t-[24px] bg-slate-950 px-4 pt-3"
                        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
                    >
                        <div className="mx-auto mb-5 h-1.5 w-12 flex-shrink-0 rounded-full bg-slate-700" />

                        <div className="mx-auto max-w-md space-y-5 pb-4 sm:max-w-3xl">
                            <header className="space-y-3">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-blue-400">
                                            Estoque de Retalhos
                                        </p>
                                        <h2
                                            id="retalho-suggestion-modal-title"
                                            className="mt-1.5 text-[17px] font-bold leading-tight text-white sm:text-[22px]"
                                        >
                                            Retalhos compatíveis com esta medida
                                        </h2>
                                    </div>

                                    <button
                                        onClick={onClose}
                                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                                        aria-label="Fechar modal de retalhos"
                                    >
                                        <i className="fas fa-times text-lg"></i>
                                    </button>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full border border-slate-700/80 bg-slate-800/70 px-3 py-1.5 text-[11px] font-semibold text-slate-200">
                                        Película: {measurement.pelicula || 'Não definida'}
                                    </span>
                                    <span className="rounded-full border border-blue-500/20 bg-blue-500/15 px-3 py-1.5 text-[11px] font-semibold text-blue-300">
                                        Medida: {measurementLabel}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setIsInfoExpanded((current) => !current)}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700/80 bg-slate-800/70 text-[12px] font-bold text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
                                        aria-label={isInfoExpanded ? 'Ocultar detalhes' : 'Mostrar detalhes'}
                                        title={isInfoExpanded ? 'Ocultar detalhes' : 'Mostrar detalhes'}
                                    >
                                        ?
                                    </button>
                                </div>

                                {isInfoExpanded && (
                                    <div className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-3 text-[12px] leading-relaxed text-slate-300">
                                        {measurement.quantidade > 1
                                            ? `Esta linha tem ${measurement.quantidade} peças. O retalho escolhido será aplicado em apenas 1 peça dessa linha.`
                                            : 'Escolha a orientação de corte mais vantajosa para reaproveitar melhor o retalho e gerar a sobra automaticamente.'}
                                    </div>
                                )}
                            </header>

                            <main className="space-y-4">
                        {loading ? (
                            <div className="flex min-h-[280px] items-center justify-center">
                                <div className="w-full rounded-2xl border border-slate-700/60 bg-slate-900 p-8 text-center shadow-lg shadow-black/20">
                                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-300">
                                        <i className="fas fa-spinner fa-spin text-xl"></i>
                                    </div>
                                    <p className="mt-4 text-sm font-semibold text-white">
                                        Buscando retalhos compatíveis
                                    </p>
                                    <p className="mt-1 text-sm text-slate-400">
                                        Estamos consultando o estoque para esta película e medida.
                                    </p>
                                </div>
                            </div>
                        ) : retalhos.length === 0 ? (
                            <div className="flex min-h-[280px] items-center justify-center">
                                <div className="w-full rounded-2xl border border-dashed border-slate-700 bg-slate-900 px-6 py-10 text-center shadow-lg shadow-black/20">
                                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-800 text-slate-400">
                                        <i className="fas fa-box-open text-2xl"></i>
                                    </div>
                                    <h3 className="mt-5 text-lg font-bold text-white">
                                        Nenhum retalho compatível encontrado
                                    </h3>
                                    <p className="mt-2 text-sm leading-relaxed text-slate-400">
                                        Para aparecer aqui, o retalho precisa ter a mesma película e medidas suficientes para atender esta peça.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {retalhos.map((retalho, index) => {
                                    const isConsuming = consumingRetalhoId === retalho.id;
                                    const area = calculateAreaM2FromCentimeters(retalho.larguraCm, retalho.comprimentoCm);
                                    const consumptionPlans = getRetalhoConsumptionPlans(measurement, retalho);

                                    return (
                                        <article
                                            key={retalho.id}
                                            className="overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900 shadow-lg shadow-black/20"
                                        >
                                            <div className="border-b border-slate-800 px-4 py-4 sm:px-5">
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <h3 className="text-base font-bold text-white">
                                                                Retalho #{retalho.id}
                                                            </h3>
                                                            {index === 0 && (
                                                                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
                                                                    Melhor encaixe
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
                                                            <p>
                                                                Medida: <span className="font-semibold text-slate-100">{formatMetersFromCentimeters(retalho.larguraCm)} x {formatMetersFromCentimeters(retalho.comprimentoCm)} m</span>
                                                            </p>
                                                            <p>
                                                                Área: <span className="font-semibold text-slate-100">{area.toFixed(2).replace('.', ',')} m²</span>
                                                            </p>
                                                            <p>
                                                                QR: <span className="font-semibold text-slate-100">{retalho.codigoQr}</span>
                                                            </p>
                                                            <p>
                                                                Localização: <span className="font-semibold text-slate-100">{retalho.localizacao || 'Não informada'}</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2">
                                                {consumptionPlans.map((plan) => (
                                                    <div
                                                        key={`${retalho.id}-${plan.orientation}`}
                                                        className="rounded-2xl border border-slate-700/70 bg-slate-950/80 p-4 shadow-inner shadow-black/20"
                                                    >
                                                        <div className="flex flex-col gap-4">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <p className="text-sm font-semibold text-white">
                                                                        Corte {plan.orientationLabel}
                                                                    </p>
                                                                    <p className="mt-1 text-xs leading-relaxed text-slate-400">
                                                                        Peça aplicada: {formatMetersFromCentimeters(plan.appliedWidthCm)} x {formatMetersFromCentimeters(plan.appliedLengthCm)} m
                                                                    </p>
                                                                </div>
                                                                <div className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                                                                    {plan.orientation === 'rotated' ? '90 graus' : 'Padrão'}
                                                                </div>
                                                            </div>

                                                            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 px-3 py-3 text-xs leading-relaxed text-slate-400">
                                                                {plan.hasReusableLeftover
                                                                    ? `Sobra prevista: ${formatMetersFromCentimeters(plan.leftoverWidthCm)} x ${formatMetersFromCentimeters(plan.leftoverLengthCm)} m.`
                                                                    : `Sem sobra útil: o restante fica abaixo de ${formatMetersFromCentimeters(MIN_RESTOCKABLE_RETALHO_LENGTH_CM)} m.`}
                                                            </div>

                                                            <button
                                                                onClick={() => onConfirm(retalho, plan)}
                                                                disabled={isConsuming}
                                                                className="inline-flex w-full items-center justify-center rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-[1px] hover:bg-blue-500 disabled:cursor-wait disabled:opacity-70"
                                                            >
                                                                {isConsuming ? 'Consumindo...' : 'Usar este corte'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                            </main>
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
};

export default RetalhoSuggestionModal;
