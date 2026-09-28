import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Bobina } from '../../../types';
import { formatStockMeters } from '../../../src/lib/estoqueDimensions';
import { bobinaRemainingRatio, isBobinaLow } from '../../../src/lib/estoqueQuickFilters';
import { PackageIcon, QrCodeIcon, TrashIcon } from './EstoqueIcons';
import { StockBadge, StockRing } from './EstoqueVisuals';

type Props = {
    viewMode: 'grid' | 'list';
    filteredBobinas: Bobina[];
    onShowQR: (type: 'bobina', item: Bobina) => void;
    onChangeStatus: (type: 'bobina', item: Bobina) => void;
    onDelete: (type: 'bobina', id: number) => void;
    onOpenDetails: (selected: { type: 'bobina'; item: Bobina }) => void;
    getStatusLabel: (status: string) => string;
    getStatusColor: (status: string) => string;
};

const ratio = bobinaRemainingRatio;
const tone = (value: number) => value > .5 ? 'bg-emerald-500' : value > .2 ? 'bg-amber-500' : 'bg-rose-500';
const statusButton = 'inline-flex h-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-[12px] font-semibold text-[var(--text-body)]';
const iconButton = 'inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)]';

export default function EstoqueBobinasPanel({ viewMode, filteredBobinas, onShowQR, onChangeStatus, onDelete, onOpenDetails, getStatusLabel, getStatusColor }: Props) {
    if (!filteredBobinas.length) return (
        <div className="rounded-[var(--radius-panel)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-raised)] px-6 py-12 text-center shadow-[var(--shadow-soft)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[var(--radius-panel)] bg-[var(--surface-muted)] text-[var(--text-muted)]"><PackageIcon /></div>
            <p className="mt-4 text-[1.05rem] font-semibold text-[var(--text-strong)]">Nenhuma bobina encontrada</p>
            <p className="mt-2 text-[13px] text-[var(--text-muted)]">Ajuste os filtros ou cadastre uma nova bobina.</p>
        </div>
    );

    // Celular: um cartão por bobina, com o anel do quanto ainda resta.
    const mobile = (
        <ul className="space-y-2 sm:hidden" aria-label="Bobinas">
            {filteredBobinas.map(item => {
                const remaining = ratio(item);
                const details = [`#${item.id}`, `${item.larguraCm} cm`, item.lote ? `Lote ${item.lote}` : '', item.localizacao || ''].filter(Boolean).join(' · ');
                return (
                    <li key={item.id}>
                        <button type="button" onClick={() => onOpenDetails({ type: 'bobina', item })}
                            className="flex w-full items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3 text-left shadow-[var(--shadow-hairline)] transition-colors active:bg-[var(--surface-muted)]">
                            <StockRing ratio={remaining} active={item.status === 'ativa'} />
                            <span className="min-w-0 flex-1">
                                <span className="flex min-w-0 items-center gap-1.5">
                                    <span className="truncate text-[15px] font-semibold text-[var(--text-strong)]">{item.filmId}</span>
                                    {isBobinaLow(item) ? <StockBadge tone="warn">Acabando</StockBadge>
                                        : item.status !== 'ativa' ? <StockBadge tone={item.status === 'descartada' ? 'danger' : 'muted'}>{getStatusLabel(item.status)}</StockBadge> : null}
                                </span>
                                <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">{details}</span>
                            </span>
                            <span className="shrink-0 text-right">
                                <span className="block text-base font-semibold tabular-nums text-[var(--text-strong)]">{formatStockMeters(item.comprimentoRestanteM)} m</span>
                                <span className="block text-[11px] tabular-nums text-[var(--text-muted)]">de {formatStockMeters(item.comprimentoTotalM)} m</span>
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-soft)]" aria-hidden="true" />
                        </button>
                    </li>
                );
            })}
        </ul>
    );

    const desktopGrid = (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredBobinas.map(item => {
                const remaining = ratio(item);
                return <article key={item.id} className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-[var(--shadow-hairline)]">
                    <span className="absolute inset-x-0 top-0 h-1 bg-[var(--brand-primary)]" />
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[1.02rem] font-semibold text-[var(--text-strong)]">{item.filmId}</p><p className="mt-1 text-[12px] text-[var(--text-muted)]">Bobina #{item.id}{item.localizacao ? ` · ${item.localizacao}` : ''}</p></div><span className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase text-white" style={{ backgroundColor: getStatusColor(item.status) }}>{getStatusLabel(item.status)}</span></div>
                    <div className="mt-4 rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3"><p className="text-[10px] font-semibold uppercase text-[var(--text-muted)]">Disponível</p><p className="mt-1 text-[2rem] font-semibold tabular-nums text-[var(--text-strong)]">{formatStockMeters(item.comprimentoRestanteM)}<span className="ml-1 text-[.95rem] text-[var(--text-muted)]">m</span></p><div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--surface)]"><div className={`h-full rounded-full ${tone(remaining)}`} style={{ width: `${remaining * 100}%` }} /></div></div>
                    <p className="mt-3 text-[11px] text-[var(--text-muted)]">{item.larguraCm} cm · {formatStockMeters(item.comprimentoTotalM)}m total{item.lote ? ` · Lote ${item.lote}` : ''}</p>
                    <div className="mt-4 flex gap-2 border-t border-[var(--border-subtle)] pt-4"><button className={`${statusButton} flex-1`} onClick={() => onChangeStatus('bobina', item)}>Status</button><button className={iconButton} onClick={() => onShowQR('bobina', item)} title="QR Code"><QrCodeIcon /></button><button className={`${iconButton} text-rose-500`} onClick={() => onDelete('bobina', item.id!)} title="Excluir"><TrashIcon /></button></div>
                </article>;
            })}
        </div>
    );

    const desktopList = (
        <div className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)]">
            {filteredBobinas.map((item, index) => <article key={item.id} className={`flex items-center gap-4 px-5 py-4 ${index ? 'border-t border-[var(--border-subtle)]' : ''}`}><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-[15px] font-semibold text-[var(--text-strong)]">{item.filmId}</p><span className="rounded-full px-2 py-0.5 text-[10px] uppercase text-white" style={{ backgroundColor: getStatusColor(item.status) }}>{getStatusLabel(item.status)}</span></div><p className="mt-1 text-[12px] tabular-nums text-[var(--text-muted)]">#{item.id} · {item.larguraCm} cm · {formatStockMeters(item.comprimentoRestanteM)}m livres</p></div><button className={statusButton} onClick={() => onChangeStatus('bobina', item)}>Status</button><button className={iconButton} onClick={() => onShowQR('bobina', item)}><QrCodeIcon /></button><button className={`${iconButton} text-rose-500`} onClick={() => onDelete('bobina', item.id!)}><TrashIcon /></button></article>)}
        </div>
    );

    return <>{mobile}<div className="hidden sm:block">{viewMode === 'grid' ? desktopGrid : desktopList}</div></>;
}
