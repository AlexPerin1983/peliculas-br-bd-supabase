import React from 'react';
import { MoreVertical } from 'lucide-react';
import { Retalho } from '../../../types';
import { QrCodeIcon, ScissorsIcon, TrashIcon } from './EstoqueIcons';

type Props = {
    viewMode: 'grid' | 'list';
    filteredRetalhos: Retalho[];
    onShowQR: (type: 'retalho', item: Retalho) => void;
    onChangeStatus: (type: 'retalho', item: Retalho) => void;
    onDelete: (type: 'retalho', id: number) => void;
    onOpenDetails: (selected: { type: 'retalho'; item: Retalho }) => void;
    getStatusLabel: (status: string) => string;
    getStatusColor: (status: string) => string;
};

const area = (item: Retalho) => item.areaM2?.toFixed(2) || ((item.larguraCm * item.comprimentoCm) / 10000).toFixed(2);
const statusButton = 'inline-flex h-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-[12px] font-semibold text-[var(--text-body)]';
const iconButton = 'inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)]';

export default function EstoqueRetalhosPanel({ viewMode, filteredRetalhos, onShowQR, onChangeStatus, onDelete, onOpenDetails, getStatusLabel, getStatusColor }: Props) {
    if (!filteredRetalhos.length) return <div className="rounded-[var(--radius-panel)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-raised)] px-6 py-12 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[var(--radius-panel)] bg-[var(--surface-muted)] text-[var(--text-muted)]"><ScissorsIcon /></div><p className="mt-4 text-[1.05rem] font-semibold text-[var(--text-strong)]">Nenhum retalho encontrado</p><p className="mt-2 text-[13px] text-[var(--text-muted)]">Ajuste os filtros ou cadastre um novo retalho.</p></div>;

    const mobile = <div className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-hairline)] sm:hidden">{filteredRetalhos.map((item, index) => <button key={item.id} type="button" onClick={() => onOpenDetails({ type: 'retalho', item })} className={`block w-full px-3.5 py-3 text-left active:bg-[var(--surface-muted)] ${index ? 'border-t border-[var(--border-subtle)]' : ''}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-[13px] font-semibold text-[var(--text-strong)]">{item.filmId}</p><span className="shrink-0 rounded-full px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-white" style={{ backgroundColor: getStatusColor(item.status) }}>{getStatusLabel(item.status)}</span></div><p className="mt-1 truncate text-[10px] text-[var(--text-muted)]">#{item.id} · {item.larguraCm} × {item.comprimentoCm} cm{item.localizacao ? ` · ${item.localizacao}` : ''}</p></div><div className="flex shrink-0 items-center gap-2"><div className="text-right"><p className="text-[8px] font-semibold uppercase text-[var(--text-muted)]">Área</p><p className="mt-0.5 text-[15px] font-semibold text-[var(--text-strong)]">{area(item)}m²</p></div><MoreVertical className="h-4 w-4 text-[var(--text-muted)]" /></div></div></button>)}</div>;

    const grid = <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filteredRetalhos.map(item => <article key={item.id} className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-[var(--shadow-hairline)]"><span className="absolute inset-x-0 top-0 h-1 bg-[var(--brand-primary)]"/><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[1.02rem] font-semibold text-[var(--text-strong)]">{item.filmId}</p><p className="mt-1 text-[12px] text-[var(--text-muted)]">Retalho #{item.id}</p></div><span className="rounded-full px-2.5 py-1 text-[10px] uppercase text-white" style={{ backgroundColor: getStatusColor(item.status) }}>{getStatusLabel(item.status)}</span></div><div className="mt-4 rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3"><p className="text-[10px] uppercase text-[var(--text-muted)]">Área</p><p className="mt-1 text-[2rem] font-semibold text-[var(--text-strong)]">{area(item)}<span className="ml-1 text-[.95rem] text-[var(--text-muted)]">m²</span></p><p className="mt-2 text-[11px] text-[var(--text-muted)]">{item.larguraCm} × {item.comprimentoCm} cm</p></div><div className="mt-4 flex gap-2 border-t border-[var(--border-subtle)] pt-4"><button className={`${statusButton} flex-1`} onClick={() => onChangeStatus('retalho', item)}>Status</button><button className={iconButton} onClick={() => onShowQR('retalho', item)}><QrCodeIcon /></button><button className={`${iconButton} text-rose-500`} onClick={() => onDelete('retalho', item.id!)}><TrashIcon /></button></div></article>)}</div>;

    const list = <div className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)]">{filteredRetalhos.map((item, index) => <article key={item.id} className={`flex items-center gap-4 px-5 py-4 ${index ? 'border-t border-[var(--border-subtle)]' : ''}`}><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-[15px] font-semibold text-[var(--text-strong)]">{item.filmId}</p><span className="rounded-full px-2 py-0.5 text-[10px] uppercase text-white" style={{ backgroundColor: getStatusColor(item.status) }}>{getStatusLabel(item.status)}</span></div><p className="mt-1 text-[12px] text-[var(--text-muted)]">#{item.id} · {item.larguraCm} × {item.comprimentoCm} cm · {area(item)}m²</p></div><button className={statusButton} onClick={() => onChangeStatus('retalho', item)}>Status</button><button className={iconButton} onClick={() => onShowQR('retalho', item)}><QrCodeIcon /></button><button className={`${iconButton} text-rose-500`} onClick={() => onDelete('retalho', item.id!)}><TrashIcon /></button></article>)}</div>;

    return <>{mobile}<div className="hidden sm:block">{viewMode === 'grid' ? grid : list}</div></>;
}
