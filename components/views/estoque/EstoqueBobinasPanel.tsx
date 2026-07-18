import React from 'react';
import { MoreVertical } from 'lucide-react';
import { Bobina } from '../../../types';
import { PackageIcon, QrCodeIcon, TrashIcon } from './EstoqueIcons';

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

const ratio = (item: Bobina) => item.comprimentoTotalM ? Math.max(0, Math.min(1, item.comprimentoRestanteM / item.comprimentoTotalM)) : 0;
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

    const mobile = (
        <div className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-hairline)] sm:hidden">
            {filteredBobinas.map((item, index) => {
                const remaining = ratio(item);
                return (
                    <button key={item.id} type="button" onClick={() => onOpenDetails({ type: 'bobina', item })} className={`block w-full px-3.5 py-3 text-left active:bg-[var(--surface-muted)] ${index ? 'border-t border-[var(--border-subtle)]' : ''}`}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 items-center gap-2">
                                    <p className="truncate text-[13px] font-semibold text-[var(--text-strong)]">{item.filmId}</p>
                                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-white" style={{ backgroundColor: getStatusColor(item.status) }}>{getStatusLabel(item.status)}</span>
                                </div>
                                <p className="mt-1 truncate text-[10px] text-[var(--text-muted)]">#{item.id} · {item.larguraCm} cm{item.lote ? ` · Lote ${item.lote}` : ''}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                <div className="text-right"><p className="text-[8px] font-semibold uppercase text-[var(--text-muted)]">Restante</p><p className="mt-0.5 text-[15px] font-semibold text-[var(--text-strong)]">{item.comprimentoRestanteM.toFixed(1)}m</p></div>
                                <MoreVertical className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
                            </div>
                        </div>
                        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]"><div className={`h-full rounded-full ${tone(remaining)}`} style={{ width: `${remaining * 100}%` }} /></div>
                        <p className="mt-1.5 truncate text-[9px] text-[var(--text-soft)]">{item.comprimentoTotalM}m total{item.fornecedor ? ` · ${item.fornecedor}` : ''}{item.localizacao ? ` · ${item.localizacao}` : ''}</p>
                    </button>
                );
            })}
        </div>
    );

    const desktopGrid = (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredBobinas.map(item => {
                const remaining = ratio(item);
                return <article key={item.id} className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-[var(--shadow-hairline)]">
                    <span className="absolute inset-x-0 top-0 h-1 bg-[var(--brand-primary)]" />
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[1.02rem] font-semibold text-[var(--text-strong)]">{item.filmId}</p><p className="mt-1 text-[12px] text-[var(--text-muted)]">Bobina #{item.id}{item.localizacao ? ` · ${item.localizacao}` : ''}</p></div><span className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase text-white" style={{ backgroundColor: getStatusColor(item.status) }}>{getStatusLabel(item.status)}</span></div>
                    <div className="mt-4 rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3"><p className="text-[10px] font-semibold uppercase text-[var(--text-muted)]">Disponível</p><p className="mt-1 text-[2rem] font-semibold text-[var(--text-strong)]">{item.comprimentoRestanteM.toFixed(1)}<span className="ml-1 text-[.95rem] text-[var(--text-muted)]">m</span></p><div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--surface)]"><div className={`h-full rounded-full ${tone(remaining)}`} style={{ width: `${remaining * 100}%` }} /></div></div>
                    <p className="mt-3 text-[11px] text-[var(--text-muted)]">{item.larguraCm} cm · {item.comprimentoTotalM}m total{item.lote ? ` · Lote ${item.lote}` : ''}</p>
                    <div className="mt-4 flex gap-2 border-t border-[var(--border-subtle)] pt-4"><button className={`${statusButton} flex-1`} onClick={() => onChangeStatus('bobina', item)}>Status</button><button className={iconButton} onClick={() => onShowQR('bobina', item)} title="QR Code"><QrCodeIcon /></button><button className={`${iconButton} text-rose-500`} onClick={() => onDelete('bobina', item.id!)} title="Excluir"><TrashIcon /></button></div>
                </article>;
            })}
        </div>
    );

    const desktopList = (
        <div className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)]">
            {filteredBobinas.map((item, index) => <article key={item.id} className={`flex items-center gap-4 px-5 py-4 ${index ? 'border-t border-[var(--border-subtle)]' : ''}`}><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-[15px] font-semibold text-[var(--text-strong)]">{item.filmId}</p><span className="rounded-full px-2 py-0.5 text-[10px] uppercase text-white" style={{ backgroundColor: getStatusColor(item.status) }}>{getStatusLabel(item.status)}</span></div><p className="mt-1 text-[12px] text-[var(--text-muted)]">#{item.id} · {item.larguraCm} cm · {item.comprimentoRestanteM.toFixed(1)}m livres</p></div><button className={statusButton} onClick={() => onChangeStatus('bobina', item)}>Status</button><button className={iconButton} onClick={() => onShowQR('bobina', item)}><QrCodeIcon /></button><button className={`${iconButton} text-rose-500`} onClick={() => onDelete('bobina', item.id!)}><TrashIcon /></button></article>)}
        </div>
    );

    return <>{mobile}<div className="hidden sm:block">{viewMode === 'grid' ? desktopGrid : desktopList}</div></>;
}
