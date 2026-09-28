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

const TONES: Record<EstoqueStatusTone, { tile: string; current: string; mark: string }> = {
    good: { tile: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', current: 'border-emerald-500 bg-emerald-500/5', mark: 'text-emerald-600 dark:text-emerald-400' },
    warn: { tile: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', current: 'border-amber-500 bg-amber-500/5', mark: 'text-amber-600 dark:text-amber-400' },
    muted: { tile: 'bg-slate-500/15 text-slate-600 dark:text-slate-300', current: 'border-slate-400 bg-slate-500/5', mark: 'text-slate-600 dark:text-slate-300' },
    danger: { tile: 'bg-rose-500/15 text-rose-600 dark:text-rose-400', current: 'border-rose-500 bg-rose-500/5', mark: 'text-rose-600 dark:text-rose-400' },
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

/** Folha para trocar o status de uma bobina ou retalho (celular e QR). */
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
                <Drawer.Overlay className="fixed inset-0 z-[60] bg-slate-950/55 backdrop-blur-[2px]" />
                <Drawer.Content className="fixed inset-x-0 bottom-0 z-[61] flex max-h-[92dvh] flex-col rounded-t-[26px] border-t border-[var(--border-subtle)] bg-[var(--surface)] outline-none">
                    <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-[var(--border-strong)]" />
                    <div className="mx-auto w-full max-w-md overflow-y-auto overscroll-contain px-4 pt-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
                        <Drawer.Title className="text-lg font-semibold text-[var(--text-strong)]">Alterar status</Drawer.Title>
                        <Drawer.Description className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                            {item.filmId} · {describeItem(type, item)}
                        </Drawer.Description>

                        <div className="mt-4 space-y-2" role="radiogroup" aria-label="Status">
                            {statusOptions.map((option) => {
                                const meta = ESTOQUE_STATUS_META[option.value];
                                const tone = TONES[meta?.tone ?? 'muted'];
                                const Icon = meta?.icon;
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
                                        className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors disabled:cursor-default ${isCurrent
                                            ? `border-2 ${tone.current}`
                                            : 'border-[var(--border-subtle)] bg-[var(--surface-raised)] enabled:active:bg-[var(--surface-muted)]'} ${saving !== null && !isSaving && !isCurrent ? 'opacity-50' : ''}`}
                                    >
                                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.tile}`}>
                                            {Icon ? <Icon className="h-5 w-5" aria-hidden="true" /> : <span className="text-[13px] font-bold">{option.emoji}</span>}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-semibold text-[var(--text-strong)]">{meta?.label ?? getStatusLabel(option.value)}</span>
                                            {meta ? <span className="mt-0.5 block text-xs leading-4 text-[var(--text-muted)]">{meta.description}</span> : null}
                                        </span>
                                        {isSaving ? (
                                            <LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-[var(--text-muted)]" aria-label="Salvando" />
                                        ) : isCurrent ? (
                                            <span className={`inline-flex shrink-0 items-center gap-1 text-xs font-semibold ${tone.mark}`}>
                                                <Check className="h-4 w-4" aria-hidden="true" /> Atual
                                            </span>
                                        ) : null}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-4 text-sm font-semibold">
                            <button type="button" onClick={onClose} disabled={saving !== null}
                                className="flex h-12 w-full items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--text-body)] transition active:scale-[0.99] disabled:opacity-60">
                                Cancelar
                            </button>
                        </div>
                        {item.id ? (
                            <div className="mt-1 flex justify-center text-xs font-semibold">
                                <button type="button" onClick={handleDelete} disabled={saving !== null}
                                    className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-rose-600 transition hover:bg-rose-50 disabled:opacity-60 dark:text-rose-400 dark:hover:bg-rose-950/30">
                                    <Trash2 className="h-4 w-4" aria-hidden="true" /> Excluir {type === 'bobina' ? 'bobina' : 'retalho'}
                                </button>
                            </div>
                        ) : null}
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
};
