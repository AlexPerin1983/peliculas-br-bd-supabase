import React, { useState } from 'react';
import { Drawer } from 'vaul';
import { Check, LoaderCircle, Trash2 } from 'lucide-react';
import { Bobina, Retalho } from '../../types';
import { formatStockMeters } from '../../src/lib/estoqueDimensions';
import { ESTOQUE_STATUS_META, type EstoqueStatusTone } from '../views/estoque/estoqueStatus';

interface StatusOption {
    value: string;
    label: string;
    emoji: string;
    color: string;
}

interface StatusDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'bobina' | 'retalho';
    item: Bobina | Retalho;
    currentStatus: string;
    statusOptions: StatusOption[];
    // Quem chama fecha a folha quando salvar; se der erro, ela continua aberta.
    onStatusChange: (newStatus: string) => Promise<void> | void;
    onDelete: (type: 'bobina' | 'retalho', id: number) => void;
    getStatusLabel: (status: string) => string;
    getStatusColor: (status: string) => string;
}

// A cor do status fica só no ponto, como nos cartões do Estoque ("● Ativa").
const DOT: Record<EstoqueStatusTone, string> = {
    good: 'bg-emerald-500',
    warn: 'bg-amber-500',
    muted: 'bg-slate-400',
    danger: 'bg-rose-500',
};

const decimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const describeItem = (type: 'bobina' | 'retalho', item: Bobina | Retalho) => {
    if (type === 'bobina') {
        const bobina = item as Bobina;
        return `Bobina #${bobina.id} · ${formatStockMeters(bobina.comprimentoRestanteM)} m restantes`;
    }
    const retalho = item as Retalho;
    return `Retalho #${retalho.id} · ${decimal.format(retalho.larguraCm / 100)} × ${decimal.format(retalho.comprimentoCm / 100)} m`;
};

/** Troca o status de uma bobina ou retalho: folha no celular, janela no computador. */
export const StatusDrawer: React.FC<StatusDrawerProps> = ({
    isOpen,
    onClose,
    type,
    item,
    currentStatus,
    statusOptions,
    onStatusChange,
    onDelete,
    getStatusLabel,
}) => {
    const [saving, setSaving] = useState<string | null>(null);

    const handleStatusSelect = async (newStatus: string) => {
        setSaving(newStatus);
        try {
            await onStatusChange(newStatus);
        } finally {
            setSaving(null);
        }
    };

    const handleDelete = () => {
        if (item.id) {
            onDelete(type, item.id);
            onClose();
        }
    };

    return (
        <Drawer.Root open={isOpen} onOpenChange={(open) => !open && !saving && onClose()}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/50" />
                {/* No computador vira uma janela no meio da tela (inset-0 + m-auto, sem transform, que o vaul usa na animação). */}
                <Drawer.Content className="fixed inset-x-0 bottom-0 z-[61] flex max-h-[92dvh] flex-col rounded-t-2xl border-t border-[var(--border-subtle)] bg-[var(--surface)] outline-none sm:inset-0 sm:m-auto sm:h-fit sm:w-[420px] sm:rounded-2xl sm:border sm:shadow-xl sm:after:hidden">
                    <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-[var(--border-strong)] sm:hidden" />
                    <div className="w-full overflow-y-auto overscroll-contain px-5 pt-4 sm:pt-5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
                        <Drawer.Title className="text-base font-semibold text-[var(--text-strong)]">Alterar status</Drawer.Title>
                        <Drawer.Description className="mt-0.5 truncate text-xs tabular-nums text-[var(--text-muted)]">
                            {item.filmId} · {describeItem(type, item)}
                        </Drawer.Description>

                        <div className="mt-4 space-y-1.5" role="radiogroup" aria-label="Status">
                            {statusOptions.map((option) => {
                                const meta = ESTOQUE_STATUS_META[option.value];
                                const dot = DOT[meta?.tone ?? 'muted'];
                                const isCurrent = currentStatus === option.value;
                                const isSaving = saving === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        role="radio"
                                        aria-checked={isCurrent}
                                        onClick={() => void handleStatusSelect(option.value)}
                                        disabled={isCurrent || saving !== null}
                                        className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] ${isCurrent
                                            ? 'border-[var(--border-strong)] bg-[var(--surface-muted)]'
                                            : 'border-[var(--border-subtle)] enabled:hover:bg-[var(--surface-muted)] enabled:active:bg-[var(--surface-muted)]'} ${saving !== null && !isSaving && !isCurrent ? 'opacity-50' : ''}`}
                                    >
                                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-medium text-[var(--text-strong)]">{meta?.label ?? getStatusLabel(option.value)}</span>
                                            {meta ? <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{meta.description}</span> : null}
                                        </span>
                                        {isSaving ? (
                                            <LoaderCircle className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-[var(--text-muted)]" aria-label="Salvando" />
                                        ) : isCurrent ? (
                                            <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-[var(--text-muted)]">
                                                <Check className="h-4 w-4" aria-hidden="true" />
                                                <span className="text-xs">Atual</span>
                                            </span>
                                        ) : null}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-5 flex items-center justify-between gap-3">
                            {item.id ? (
                                <button type="button" onClick={handleDelete} disabled={saving !== null}
                                    className="-ml-2 inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-[var(--text-muted)] transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60 dark:hover:bg-rose-950/30 dark:hover:text-rose-400">
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                    <span className="text-xs font-medium">Excluir {type === 'bobina' ? 'bobina' : 'retalho'}</span>
                                </button>
                            ) : <span />}
                            <button type="button" onClick={onClose} disabled={saving !== null}
                                className="inline-flex h-10 items-center rounded-xl border border-[var(--border-subtle)] px-4 text-[var(--text-body)] transition-colors hover:bg-[var(--surface-muted)] disabled:opacity-60">
                                <span className="text-sm font-medium">Cancelar</span>
                            </button>
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
};
