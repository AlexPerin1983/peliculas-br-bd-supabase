import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock3, History, Loader2, RotateCcw, Smartphone } from 'lucide-react';
import { ProposalOption } from '../../types';
import { ProposalOptionsHistoryEntry } from '../../services/proposalSync';
import * as db from '../../services/db';
import Modal from '../ui/Modal';
import ActionButton from '../ui/ActionButton';
import ConfirmationModal from './ConfirmationModal';

interface MeasurementHistoryModalProps {
    isOpen: boolean;
    clientId: number;
    clientName?: string;
    onClose: () => void;
    onRestored: (options: ProposalOption[]) => void | Promise<void>;
}

const formatDate = (value: string): string => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Data não informada';

    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    }).format(date);
};

const parseDimension = (value: string): number => {
    const parsed = Number(String(value || '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
};

const getVersionTotals = (options: ProposalOption[]) => {
    const measurements = options.flatMap(option => option.measurements || []);
    return {
        groups: measurements.length,
        pieces: measurements.reduce((total, measurement) => total + (Number(measurement.quantidade) || 0), 0),
        area: measurements.reduce((total, measurement) => (
            total
            + parseDimension(measurement.largura)
            * parseDimension(measurement.altura)
            * (Number(measurement.quantidade) || 0)
        ), 0)
    };
};

const getDeviceLabel = (entry: ProposalOptionsHistoryEntry): string => {
    if (entry.isCurrentDevice) return 'Este aparelho';
    if (entry.sourceDeviceId === 'migration') return 'Dados anteriores';
    if (entry.sourceDeviceId === 'direct-write') return 'Sistema';
    if (entry.sourceDeviceId === 'legacy-client') return 'Versão antiga do app';
    return entry.sourceDeviceId ? 'Outro aparelho' : 'Origem não identificada';
};

const getErrorMessage = (error: unknown): string => (
    error instanceof Error ? error.message : 'Não foi possível carregar o histórico de medidas.'
);

const MeasurementHistoryModal: React.FC<MeasurementHistoryModalProps> = ({
    isOpen,
    clientId,
    clientName,
    onClose,
    onRestored
}) => {
    const [entries, setEntries] = useState<ProposalOptionsHistoryEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedRevision, setExpandedRevision] = useState<number | null>(null);
    const [selectedEntry, setSelectedEntry] = useState<ProposalOptionsHistoryEntry | null>(null);
    const [isRestoring, setIsRestoring] = useState(false);

    const loadHistory = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const history = await db.getProposalOptionsHistory(clientId);
            setEntries(history);
            setExpandedRevision(history[0]?.revision ?? null);
        } catch (loadError) {
            setEntries([]);
            setError(getErrorMessage(loadError));
        } finally {
            setIsLoading(false);
        }
    }, [clientId]);

    useEffect(() => {
        if (!isOpen) {
            setSelectedEntry(null);
            return;
        }

        void loadHistory();
    }, [isOpen, loadHistory]);

    const currentRevision = entries[0]?.revision ?? null;
    const selectedTotals = useMemo(
        () => selectedEntry ? getVersionTotals(selectedEntry.options) : null,
        [selectedEntry]
    );

    const handleRestore = async () => {
        if (!selectedEntry) return;

        setIsRestoring(true);
        setError(null);
        try {
            const restoredOptions = await db.restoreProposalOptionsVersion(clientId, selectedEntry.options);
            await onRestored(restoredOptions);
            setSelectedEntry(null);
            onClose();
        } catch (restoreError) {
            setSelectedEntry(null);
            setError(getErrorMessage(restoreError));
        } finally {
            setIsRestoring(false);
        }
    };

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={isRestoring ? () => {} : onClose}
                disableClose={isRestoring}
                title={(
                    <span className="inline-flex items-center gap-2">
                        <History className="h-5 w-5 text-[var(--brand-primary)]" aria-hidden="true" />
                        Histórico de medidas
                    </span>
                )}
                wrapperClassName="sm:max-w-3xl"
            >
                <div className="space-y-4">
                    <div className="rounded-[var(--radius-control)] border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm leading-6 text-[var(--text-body)]">
                        <p className="font-bold text-[var(--text-strong)]">
                            {clientName ? `Cliente: ${clientName}` : 'Versões salvas no servidor'}
                        </p>
                        <p className="mt-0.5 text-[var(--text-muted)]">
                            Cada alteração confirmada gera uma versão. Restaurar também cria uma nova versão, portanto nada do histórico é apagado.
                        </p>
                    </div>

                    {isLoading && (
                        <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-[var(--text-muted)]" role="status">
                            <Loader2 className="h-7 w-7 animate-spin text-[var(--brand-primary)]" aria-hidden="true" />
                            <p className="text-sm font-semibold">Sincronizando e carregando versões...</p>
                        </div>
                    )}

                    {!isLoading && error && (
                        <div className="rounded-[var(--radius-control)] border border-red-500/25 bg-red-500/10 p-4" role="alert">
                            <div className="flex gap-3">
                                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-hidden="true" />
                                <div className="min-w-0">
                                    <p className="font-bold text-red-700 dark:text-red-300">Não foi possível continuar</p>
                                    <p className="mt-1 text-sm leading-5 text-red-700/85 dark:text-red-200/85">{error}</p>
                                    <ActionButton onClick={() => { void loadHistory(); }} variant="secondary" size="sm" className="mt-3">
                                        Tentar novamente
                                    </ActionButton>
                                </div>
                            </div>
                        </div>
                    )}

                    {!isLoading && !error && entries.length === 0 && (
                        <div className="flex min-h-48 flex-col items-center justify-center rounded-[var(--radius-panel)] border border-dashed border-[var(--border-subtle)] px-6 text-center">
                            <Clock3 className="h-8 w-8 text-[var(--text-soft)]" aria-hidden="true" />
                            <p className="mt-3 font-bold text-[var(--text-strong)]">Nenhuma versão encontrada</p>
                            <p className="mt-1 max-w-md text-sm text-[var(--text-muted)]">
                                O histórico começa a aparecer depois que as medidas são confirmadas no servidor.
                            </p>
                        </div>
                    )}

                    {!isLoading && !error && entries.length > 0 && (
                        <div className="space-y-3" aria-label="Versões salvas das medidas">
                            {entries.map(entry => {
                                const totals = getVersionTotals(entry.options);
                                const isCurrent = entry.revision === currentRevision;
                                const isExpanded = entry.revision === expandedRevision;

                                return (
                                    <article
                                        key={entry.id}
                                        className={`overflow-hidden rounded-[var(--radius-panel)] border transition-colors ${
                                            isCurrent
                                                ? 'border-emerald-500/35 bg-emerald-500/[0.06]'
                                                : 'border-[var(--border-subtle)] bg-[var(--surface-raised)]'
                                        }`}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => setExpandedRevision(isExpanded ? null : entry.revision)}
                                            className="flex w-full items-start gap-3 p-4 text-left"
                                            aria-expanded={isExpanded}
                                        >
                                            <span className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                                                isCurrent
                                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                                                    : 'bg-[var(--surface-muted)] text-[var(--text-muted)]'
                                            }`}>
                                                {isCurrent
                                                    ? <CheckCircle2 className="h-[18px] w-[18px]" aria-hidden="true" />
                                                    : <Clock3 className="h-[18px] w-[18px]" aria-hidden="true" />}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="flex flex-wrap items-center gap-2">
                                                    <span className="font-black text-[var(--text-strong)]">Versão {entry.revision}</span>
                                                    {isCurrent && (
                                                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                                                            Atual
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="mt-1 block text-sm text-[var(--text-muted)]">{formatDate(entry.createdAt)}</span>
                                                <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-[var(--text-body)]">
                                                    <span>{totals.groups} grupo{totals.groups === 1 ? '' : 's'}</span>
                                                    <span>{totals.pieces} peça{totals.pieces === 1 ? '' : 's'}</span>
                                                    <span>{totals.area.toFixed(2).replace('.', ',')} m²</span>
                                                </span>
                                            </span>
                                            {isExpanded
                                                ? <ChevronUp className="mt-2 h-4 w-4 shrink-0 text-[var(--text-soft)]" aria-hidden="true" />
                                                : <ChevronDown className="mt-2 h-4 w-4 shrink-0 text-[var(--text-soft)]" aria-hidden="true" />}
                                        </button>

                                        {isExpanded && (
                                            <div className="border-t border-[var(--border-subtle)] px-4 pb-4 pt-3">
                                                <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
                                                    <Smartphone className="h-4 w-4" aria-hidden="true" />
                                                    {getDeviceLabel(entry)}
                                                </div>

                                                <div className="space-y-2">
                                                    {entry.options.map(option => (
                                                        <div key={option.id} className="rounded-[var(--radius-control)] bg-[var(--surface-muted)] p-3">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <p className="truncate text-sm font-bold text-[var(--text-strong)]">{option.name}</p>
                                                                <span className="shrink-0 text-xs font-semibold text-[var(--text-muted)]">
                                                                    {option.measurements?.length || 0} grupo{option.measurements?.length === 1 ? '' : 's'}
                                                                </span>
                                                            </div>
                                                            {!!option.measurements?.length && (
                                                                <ul className="mt-2 space-y-1 text-xs text-[var(--text-muted)]">
                                                                    {option.measurements.slice(0, 5).map(measurement => (
                                                                        <li key={measurement.id} className="flex justify-between gap-3">
                                                                            <span className="truncate">{measurement.ambiente || 'Sem ambiente'}</span>
                                                                            <span className="shrink-0 font-semibold text-[var(--text-body)]">
                                                                                {measurement.largura} × {measurement.altura} · {measurement.quantidade}x
                                                                            </span>
                                                                        </li>
                                                                    ))}
                                                                    {option.measurements.length > 5 && (
                                                                        <li className="font-semibold text-[var(--brand-primary)]">
                                                                            + {option.measurements.length - 5} grupo{option.measurements.length - 5 === 1 ? '' : 's'}
                                                                        </li>
                                                                    )}
                                                                </ul>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>

                                                {!isCurrent && (
                                                    <ActionButton
                                                        onClick={() => setSelectedEntry(entry)}
                                                        variant="secondary"
                                                        size="md"
                                                        icon={<RotateCcw className="h-4 w-4" />}
                                                        className="mt-4 w-full sm:w-auto"
                                                    >
                                                        Restaurar esta versão
                                                    </ActionButton>
                                                )}
                                            </div>
                                        )}
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </div>
            </Modal>

            <ConfirmationModal
                isOpen={selectedEntry !== null}
                onClose={() => setSelectedEntry(null)}
                onConfirm={() => { void handleRestore(); }}
                title="Restaurar medidas?"
                message={selectedEntry && selectedTotals ? (
                    <div className="space-y-3">
                        <p>
                            A versão <strong>{selectedEntry.revision}</strong>, de <strong>{formatDate(selectedEntry.createdAt)}</strong>, voltará a ser a versão ativa deste cliente.
                        </p>
                        <p className="rounded-xl bg-slate-100 p-3 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {selectedTotals.groups} grupos · {selectedTotals.pieces} peças · {selectedTotals.area.toFixed(2).replace('.', ',')} m²
                        </p>
                        <p>O estado atual continuará guardado no histórico e poderá ser recuperado depois.</p>
                    </div>
                ) : null}
                confirmButtonText="Sim, restaurar"
                cancelButtonText="Cancelar"
                confirmButtonVariant="primary"
                isProcessing={isRestoring}
                processingText="Restaurando..."
                presentation="auto"
            />
        </>
    );
};

export default MeasurementHistoryModal;
