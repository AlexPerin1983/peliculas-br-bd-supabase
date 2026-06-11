import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, ClipboardCheck, RotateCcw } from 'lucide-react';
import Modal from '../ui/Modal';
import { UIMeasurement } from '../../types';
import { calculatePricingAreaM2 } from '../../src/lib/pricingArea';

// Checklist de execucao da obra: marca cada medida como "aplicada" e mostra o
// progresso em % (pecas e m²). Mexe SOMENTE no campo `aplicadoEm` — grupos,
// precos e status das medidas ficam intocados.

const parseDim = (value: string | number) => {
    const parsed = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
};

const formatM2 = (value: number) => `${value.toFixed(2).replace('.', ',')} m2`;

const measurementArea = (measurement: UIMeasurement) =>
    calculatePricingAreaM2(parseDim(measurement.largura), parseDim(measurement.altura), Number(measurement.quantidade) || 1);

export interface ApplicationProgress {
    totalPieces: number;
    appliedPieces: number;
    totalArea: number;
    appliedArea: number;
    percent: number;
    started: boolean;
}

// Resumo do progresso (so medidas ativas contam: as desmarcadas nao fazem
// parte do servico fechado).
export const getApplicationProgress = (measurements: UIMeasurement[]): ApplicationProgress => {
    let totalPieces = 0;
    let appliedPieces = 0;
    let totalArea = 0;
    let appliedArea = 0;

    measurements.forEach(measurement => {
        if (measurement.active === false) return;
        const pieces = Number(measurement.quantidade) || 1;
        const area = measurementArea(measurement);
        totalPieces += pieces;
        totalArea += area;
        if (measurement.aplicadoEm) {
            appliedPieces += pieces;
            appliedArea += area;
        }
    });

    return {
        totalPieces,
        appliedPieces,
        totalArea,
        appliedArea,
        percent: totalPieces > 0 ? (appliedPieces / totalPieces) * 100 : 0,
        started: appliedPieces > 0
    };
};

interface ProgressGroup {
    key: string;
    label: string;
    items: UIMeasurement[];
    appliedCount: number;
}

interface ApplicationProgressModalProps {
    isOpen: boolean;
    onClose: () => void;
    measurements: UIMeasurement[];
    onApplyMeasurements: (next: UIMeasurement[]) => void | Promise<void>;
}

const ApplicationProgressModal: React.FC<ApplicationProgressModalProps> = ({
    isOpen,
    onClose,
    measurements,
    onApplyMeasurements
}) => {
    const [confirmingReset, setConfirmingReset] = useState(false);

    useEffect(() => {
        if (!isOpen) setConfirmingReset(false);
    }, [isOpen]);

    const activeMeasurements = useMemo(
        () => measurements.filter(measurement => measurement.active !== false),
        [measurements]
    );

    const progress = useMemo(() => getApplicationProgress(measurements), [measurements]);

    // Agrupa por pelicula + ambiente preservando a ordem da lista, espelhando
    // como as medidas ja aparecem no mapa.
    const groups = useMemo<ProgressGroup[]>(() => {
        const byKey = new Map<string, ProgressGroup>();
        activeMeasurements.forEach(measurement => {
            const pelicula = measurement.pelicula || 'Sem pelicula';
            const ambiente = (measurement.ambiente || '').trim();
            const key = `${pelicula}|${ambiente}`;
            const group = byKey.get(key) || {
                key,
                label: ambiente ? `${pelicula} (${ambiente})` : pelicula,
                items: [],
                appliedCount: 0
            };
            group.items.push(measurement);
            if (measurement.aplicadoEm) group.appliedCount += 1;
            byKey.set(key, group);
        });
        return Array.from(byKey.values());
    }, [activeMeasurements]);

    const toggleItem = (id: number) => {
        const now = new Date().toISOString();
        void onApplyMeasurements(
            measurements.map(measurement =>
                measurement.id === id
                    ? { ...measurement, aplicadoEm: measurement.aplicadoEm ? undefined : now }
                    : measurement
            )
        );
    };

    const toggleGroup = (group: ProgressGroup) => {
        const ids = new Set(group.items.map(item => item.id));
        const markAll = group.appliedCount < group.items.length;
        const now = new Date().toISOString();
        void onApplyMeasurements(
            measurements.map(measurement =>
                ids.has(measurement.id)
                    ? { ...measurement, aplicadoEm: markAll ? measurement.aplicadoEm || now : undefined }
                    : measurement
            )
        );
    };

    const handleReset = () => {
        if (!confirmingReset) {
            setConfirmingReset(true);
            return;
        }
        setConfirmingReset(false);
        void onApplyMeasurements(
            measurements.map(measurement =>
                measurement.aplicadoEm ? { ...measurement, aplicadoEm: undefined } : measurement
            )
        );
    };

    const percentLabel = `${Math.round(progress.percent)}%`;
    const complete = progress.totalPieces > 0 && progress.appliedPieces === progress.totalPieces;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            fullScreenOnMobile
            title={
                <span className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-emerald-500" aria-hidden="true" />
                    Progresso de Aplicacao
                </span>
            }
            footer={
                <div className="flex w-full items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={handleReset}
                        disabled={!progress.started}
                        className={`inline-flex items-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                            confirmingReset
                                ? 'bg-red-600 text-white hover:bg-red-700'
                                : 'text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-red-600'
                        }`}
                    >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        {confirmingReset ? 'Toque para confirmar' : 'Reiniciar progresso'}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-[var(--radius-control)] bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--brand-primary-strong)]"
                    >
                        Fechar
                    </button>
                </div>
            }
        >
            <div className="space-y-5">
                <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
                    <div className="flex items-end justify-between gap-3">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--text-soft)]">
                                Executado
                            </p>
                            <p className={`mt-0.5 text-3xl font-black leading-none ${complete ? 'text-emerald-500' : 'text-[var(--text-strong)]'}`}>
                                {percentLabel}
                            </p>
                        </div>
                        <div className="text-right text-xs text-[var(--text-muted)]">
                            <p>
                                <strong className="text-[var(--text-strong)]">{progress.appliedPieces}</strong> de{' '}
                                {progress.totalPieces} pecas
                            </p>
                            <p className="mt-0.5">
                                <strong className="text-[var(--text-strong)]">{formatM2(progress.appliedArea)}</strong> de{' '}
                                {formatM2(progress.totalArea)}
                            </p>
                        </div>
                    </div>
                    <div
                        className="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--surface)]"
                        role="progressbar"
                        aria-valuenow={Math.round(progress.percent)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Progresso da aplicacao"
                    >
                        <div
                            className={`h-full rounded-full transition-all duration-300 ${complete ? 'bg-emerald-500' : 'bg-gradient-to-r from-emerald-500 to-emerald-400'}`}
                            style={{ width: `${Math.min(100, progress.percent)}%` }}
                        />
                    </div>
                    {complete && (
                        <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                            Tudo aplicado! Servico concluido.
                        </p>
                    )}
                </div>

                {activeMeasurements.length === 0 ? (
                    <p className="py-6 text-center text-sm text-[var(--text-muted)]">
                        Nenhuma medida ativa na proposta. Adicione medidas para acompanhar a aplicacao.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {groups.map(group => {
                            const groupComplete = group.appliedCount === group.items.length;
                            return (
                                <div
                                    key={group.key}
                                    className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)]"
                                >
                                    <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2.5">
                                        <p className="min-w-0 truncate text-sm font-bold text-[var(--text-strong)]">
                                            {group.label}
                                        </p>
                                        <div className="flex shrink-0 items-center gap-2">
                                            <span
                                                className={`rounded-full px-2 py-px text-[10px] font-bold ${
                                                    groupComplete
                                                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300'
                                                        : 'bg-[var(--surface-muted)] text-[var(--text-muted)]'
                                                }`}
                                            >
                                                {group.appliedCount}/{group.items.length}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => toggleGroup(group)}
                                                className="rounded-[var(--radius-control)] border border-[var(--border-subtle)] px-2 py-1 text-[11px] font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface-muted)]"
                                            >
                                                {groupComplete ? 'Desmarcar' : 'Marcar tudo'}
                                            </button>
                                        </div>
                                    </div>
                                    <ul className="divide-y divide-[var(--border-subtle)]">
                                        {group.items.map(item => {
                                            const applied = Boolean(item.aplicadoEm);
                                            const pieces = Number(item.quantidade) || 1;
                                            return (
                                                <li key={item.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleItem(item.id)}
                                                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-muted)]"
                                                        aria-pressed={applied}
                                                    >
                                                        {applied ? (
                                                            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" aria-hidden="true" />
                                                        ) : (
                                                            <Circle className="h-5 w-5 shrink-0 text-[var(--text-soft)]" aria-hidden="true" />
                                                        )}
                                                        <span
                                                            className={`min-w-0 flex-1 truncate text-sm ${
                                                                applied
                                                                    ? 'text-[var(--text-muted)]'
                                                                    : 'text-[var(--text-strong)]'
                                                            }`}
                                                        >
                                                            {String(item.largura || '0')} x {String(item.altura || '0')}
                                                            <span className="text-[var(--text-muted)]">
                                                                {' '}· {pieces} pc{pieces === 1 ? '' : 's'}
                                                            </span>
                                                        </span>
                                                        <span className="shrink-0 text-xs font-semibold text-[var(--text-muted)]">
                                                            {formatM2(measurementArea(item))}
                                                        </span>
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default ApplicationProgressModal;
