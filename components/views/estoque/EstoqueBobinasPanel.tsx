import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Bobina } from '../../../types';
import { formatStockMeters } from '../../../src/lib/estoqueDimensions';
import { bobinaRemainingRatio, isBobinaLow } from '../../../src/lib/estoqueQuickFilters';
import { PackageIcon, QrCodeIcon, TrashIcon } from './EstoqueIcons';
import { RollEnd, StockBadge, StockRing } from './EstoqueVisuals';

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
const statusButton = 'inline-flex h-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-[var(--text-body)] transition-colors hover:bg-[var(--surface-muted)]';
const iconButton = 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)]';

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

    // Situação: ponto na cor do status e o nome em texto calmo; "Acabando" só quando acaba.
    const statusLine = (item: Bobina) => (
        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: getStatusColor(item.status) }} aria-hidden="true" />
            {getStatusLabel(item.status)}
        </span>
    );
    const actions = (item: Bobina) => (
        <>
            <button type="button" className={`${statusButton} flex-1`} onClick={() => onChangeStatus('bobina', item)}>
                <span className="text-xs font-medium">Mudar status</span>
            </button>
            <button type="button" className={iconButton} onClick={() => onShowQR('bobina', item)} title="QR Code" aria-label={`QR Code da bobina #${item.id}`}><QrCodeIcon /></button>
            <button type="button" className={`${iconButton} hover:border-rose-300 hover:text-rose-600 dark:hover:border-rose-800 dark:hover:text-rose-400`} onClick={() => onDelete('bobina', item.id!)} title="Excluir" aria-label={`Excluir bobina #${item.id}`}><TrashIcon /></button>
        </>
    );

    const desktopGrid = (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredBobinas.map(item => {
                const remaining = ratio(item);
                const active = item.status === 'ativa';
                return <article key={item.id} className="flex flex-col rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] p-5 shadow-[var(--shadow-hairline)] transition-colors hover:border-[var(--border-strong)]">
                    <button type="button" onClick={() => onOpenDetails({ type: 'bobina', item })} className="flex items-start gap-4 text-left" aria-label={`Abrir bobina #${item.id} de ${item.filmId}`}>
                        <RollEnd ratio={remaining} active={active} />
                        <span className="min-w-0 flex-1">
                            <span className="flex items-start justify-between gap-2">
                                <span className="truncate text-base font-semibold text-[var(--text-strong)]">{item.filmId}</span>
                                {isBobinaLow(item) ? <StockBadge tone="warn">Acabando</StockBadge> : statusLine(item)}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">Bobina #{item.id}{item.localizacao ? ` · ${item.localizacao}` : ''}</span>
                            <span className="mt-3 block tabular-nums">
                                <span className="text-2xl font-semibold text-[var(--text-strong)]">{formatStockMeters(item.comprimentoRestanteM)} m</span>
                                <span className="ml-1.5 text-sm text-[var(--text-muted)]">de {formatStockMeters(item.comprimentoTotalM)} m</span>
                            </span>
                        </span>
                    </button>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]" role="presentation">
                        <div className={`h-full rounded-full ${active ? tone(remaining) : 'bg-slate-400'}`} style={{ width: `${remaining * 100}%` }} />
                    </div>
                    <p className="mt-3 text-xs text-[var(--text-muted)]">{item.larguraCm} cm de largura{item.lote ? ` · Lote ${item.lote}` : ''}</p>
                    <div className="mt-4 flex gap-2 border-t border-[var(--border-subtle)] pt-4">{actions(item)}</div>
                </article>;
            })}
        </div>
    );

    const desktopList = (
        <div className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)]">
            {filteredBobinas.map((item, index) => (
                <article key={item.id} className={`flex items-center gap-4 px-5 py-3 ${index ? 'border-t border-[var(--border-subtle)]' : ''}`}>
                    <button type="button" onClick={() => onOpenDetails({ type: 'bobina', item })} className="flex min-w-0 flex-1 items-center gap-4 text-left" aria-label={`Abrir bobina #${item.id} de ${item.filmId}`}>
                        <RollEnd ratio={ratio(item)} active={item.status === 'ativa'} size={44} />
                        <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                                <span className="truncate text-sm font-semibold text-[var(--text-strong)]">{item.filmId}</span>
                                {isBobinaLow(item) ? <StockBadge tone="warn">Acabando</StockBadge> : statusLine(item)}
                            </span>
                            <span className="mt-0.5 block truncate text-xs tabular-nums text-[var(--text-muted)]">#{item.id} · {item.larguraCm} cm{item.lote ? ` · Lote ${item.lote}` : ''}{item.localizacao ? ` · ${item.localizacao}` : ''}</span>
                        </span>
                        <span className="shrink-0 text-right tabular-nums">
                            <span className="block text-sm font-semibold text-[var(--text-strong)]">{formatStockMeters(item.comprimentoRestanteM)} m</span>
                            <span className="block text-xs text-[var(--text-muted)]">de {formatStockMeters(item.comprimentoTotalM)} m</span>
                        </span>
                    </button>
                    <div className="flex w-[220px] shrink-0 gap-2">{actions(item)}</div>
                </article>
            ))}
        </div>
    );

    return <>{mobile}<div className="hidden sm:block">{viewMode === 'grid' ? desktopGrid : desktopList}</div></>;
}
