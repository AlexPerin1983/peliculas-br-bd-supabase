import React from 'react';
import { Drawer } from 'vaul';
import { QrCode, RefreshCw, Trash2 } from 'lucide-react';
import { Bobina, Retalho } from '../../../types';
import { formatStockMeters } from '../../../src/lib/estoqueDimensions';
import { bobinaRemainingRatio, isBobinaLow } from '../../../src/lib/estoqueQuickFilters';
import { PieceShape, StockBadge, StockRing } from './EstoqueVisuals';

export type EstoqueSelectedItem = { type: 'bobina'; item: Bobina } | { type: 'retalho'; item: Retalho };

type EstoqueItemSheetProps = {
    selected: EstoqueSelectedItem | null;
    onClose: () => void;
    onShowQR: (selected: EstoqueSelectedItem) => void;
    onChangeStatus: (selected: EstoqueSelectedItem) => void;
    onDelete: (selected: EstoqueSelectedItem) => void;
    getStatusLabel: (status: string) => string;
    getStatusColor: (status: string) => string;
};

const decimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const date = (value?: string) => (value ? new Date(value).toLocaleDateString('pt-BR') : '');

const statusTone = (status: string) =>
    status === 'ativa' || status === 'disponivel' ? 'good' as const
        : status === 'descartada' || status === 'descartado' ? 'danger' as const
            : status === 'reservado' ? 'warn' as const
                : 'muted' as const;

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="min-w-0 px-2 py-3 text-center">
        <p className="truncate text-[11px] text-[var(--text-muted)]">{label}</p>
        <p className="mt-0.5 truncate text-lg font-semibold tabular-nums tracking-[-0.01em] text-[var(--text-strong)]">{value}</p>
    </div>
);

/** Ficha do material no celular: números, dados e as ações (QR, status, excluir). */
const EstoqueItemSheet: React.FC<EstoqueItemSheetProps> = ({ selected, onClose, onShowQR, onChangeStatus, onDelete, getStatusLabel }) => {
    if (!selected) return null;
    const { item } = selected;
    const bobina = selected.type === 'bobina' ? selected.item : null;
    const retalho = selected.type === 'retalho' ? selected.item : null;
    const run = (action: (value: EstoqueSelectedItem) => void) => {
        const current = selected;
        onClose();
        action(current);
    };

    const details = [
        { label: 'Lote', value: bobina?.lote },
        { label: 'Fornecedor', value: bobina?.fornecedor },
        { label: 'Local', value: item.localizacao || (retalho?.status === 'disponivel' ? 'Sem localização' : '') },
        { label: 'Custo', value: bobina?.custoTotal ? money.format(bobina.custoTotal) : '' },
        { label: 'Cadastro', value: date(item.dataCadastro) },
        { label: 'Observação', value: item.observacao },
    ].filter(entry => entry.value);

    return (
        <Drawer.Root open onOpenChange={(open) => !open && onClose()}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-[60] bg-slate-950/55 backdrop-blur-[2px]" />
                <Drawer.Content className="fixed inset-x-0 bottom-0 z-[61] flex max-h-[90dvh] flex-col rounded-t-[26px] border-t border-[var(--border-subtle)] bg-[var(--surface)] outline-none sm:hidden">
                    <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-[var(--border-strong)]" />
                    <div className="overflow-y-auto overscroll-contain px-4 pb-4 pt-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
                        <div className="flex items-center gap-3">
                            {bobina ? <StockRing ratio={bobinaRemainingRatio(bobina)} active={bobina.status === 'ativa'} size={52} />
                                : <PieceShape larguraCm={retalho!.larguraCm} comprimentoCm={retalho!.comprimentoCm} status={retalho!.status} size={52} />}
                            <div className="min-w-0 flex-1">
                                <Drawer.Title className="truncate text-lg font-semibold text-[var(--text-strong)]">{item.filmId}</Drawer.Title>
                                <Drawer.Description className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-muted)]">
                                    <span>{bobina ? 'Bobina' : 'Retalho'} #{item.id}</span>
                                    <StockBadge tone={statusTone(item.status)}>{getStatusLabel(item.status)}</StockBadge>
                                    {bobina && isBobinaLow(bobina) ? <StockBadge tone="warn">Acabando</StockBadge> : null}
                                </Drawer.Description>
                            </div>
                        </div>

                        <div className="mt-4 grid grid-cols-3 divide-x divide-[var(--border-subtle)] rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)]/60">
                            {bobina ? <>
                                <Metric label="Restante" value={`${formatStockMeters(bobina.comprimentoRestanteM)} m`} />
                                <Metric label="Total" value={`${formatStockMeters(bobina.comprimentoTotalM)} m`} />
                                <Metric label="Largura" value={`${bobina.larguraCm} cm`} />
                            </> : <>
                                <Metric label="Largura" value={`${decimal.format(retalho!.larguraCm / 100)} m`} />
                                <Metric label="Comprimento" value={`${decimal.format(retalho!.comprimentoCm / 100)} m`} />
                                <Metric label="Área" value={`${decimal.format(retalho!.areaM2 ?? (retalho!.larguraCm * retalho!.comprimentoCm) / 10000)} m²`} />
                            </>}
                        </div>

                        {details.length ? (
                            <dl className="mt-3 divide-y divide-[var(--border-subtle)] rounded-2xl border border-[var(--border-subtle)] px-3.5 text-[13px]">
                                {details.map(entry => (
                                    <div key={entry.label} className="flex items-start justify-between gap-4 py-2.5">
                                        <dt className="shrink-0 text-[var(--text-muted)]">{entry.label}</dt>
                                        <dd className={`min-w-0 text-right font-medium [overflow-wrap:anywhere] ${entry.value === 'Sem localização' ? 'text-amber-700 dark:text-amber-300' : 'text-[var(--text-strong)]'}`}>{entry.value}</dd>
                                    </div>
                                ))}
                            </dl>
                        ) : null}

                        <div className="mt-4 grid grid-cols-3 gap-2 text-xs font-semibold">
                            <button type="button" onClick={() => run(onShowQR)} className="flex h-16 flex-col items-center justify-center gap-1.5 rounded-2xl border border-[var(--border-subtle)] text-[var(--text-strong)] active:bg-[var(--surface-muted)]">
                                <QrCode className="h-5 w-5 text-[var(--brand-primary)]" aria-hidden="true" /> QR Code
                            </button>
                            <button type="button" onClick={() => run(onChangeStatus)} className="flex h-16 flex-col items-center justify-center gap-1.5 rounded-2xl border border-[var(--border-subtle)] text-[var(--text-strong)] active:bg-[var(--surface-muted)]">
                                <RefreshCw className="h-5 w-5 text-[var(--brand-primary)]" aria-hidden="true" /> Alterar status
                            </button>
                            <button type="button" onClick={() => run(onDelete)} className="flex h-16 flex-col items-center justify-center gap-1.5 rounded-2xl border border-rose-500/25 text-rose-600 active:bg-rose-50 dark:text-rose-400 dark:active:bg-rose-950/30">
                                <Trash2 className="h-5 w-5" aria-hidden="true" /> Excluir
                            </button>
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
};

export default EstoqueItemSheet;
