import React, { useMemo } from 'react';
import { ChevronRight, MapPin } from 'lucide-react';
import { Retalho } from '../../../types';
import { QrCodeIcon, ScissorsIcon, TrashIcon } from './EstoqueIcons';

type SearchDimensions = {
    larguraCm: number;
    comprimentoCm: number;
};

type Props = {
    viewMode: 'grid' | 'list';
    filteredRetalhos: Retalho[];
    searchDimensions?: SearchDimensions;
    onShowQR: (type: 'retalho', item: Retalho) => void;
    onChangeStatus: (type: 'retalho', item: Retalho) => void;
    onDelete: (type: 'retalho', id: number) => void;
    onOpenDetails: (selected: { type: 'retalho'; item: Retalho }) => void;
    getStatusLabel: (status: string) => string;
    getStatusColor: (status: string) => string;
};

const numberFormatter = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const areaValue = (item: Retalho) => item.areaM2 ?? (item.larguraCm * item.comprimentoCm) / 10000;
const area = (item: Retalho) => numberFormatter.format(areaValue(item));
const meters = (centimeters: number) => numberFormatter.format(centimeters / 100);
const statusButton = 'inline-flex h-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-[12px] font-semibold text-[var(--text-body)]';
const iconButton = 'inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)]';

const getFitLabel = (item: Retalho, index: number, searchDimensions?: SearchDimensions) => {
    if (!searchDimensions) return null;

    const requiredArea = searchDimensions.larguraCm * searchDimensions.comprimentoCm;
    const itemArea = item.larguraCm * item.comprimentoCm;
    const wasteRatio = requiredArea > 0 ? Math.max(0, itemArea - requiredArea) / requiredArea : 0;

    if (Math.abs(itemArea - requiredArea) <= 1) {
        return { label: 'Encaixe exato', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' };
    }
    if (index === 0) {
        return { label: 'Melhor encaixe', className: 'bg-blue-500/15 text-blue-600 dark:text-blue-300' };
    }
    if (wasteRatio <= 0.25) {
        return { label: 'Pouca sobra', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' };
    }
    return { label: 'Serve', className: 'bg-[var(--surface-muted)] text-[var(--text-body)]' };
};

export default function EstoqueRetalhosPanel({
    viewMode,
    filteredRetalhos,
    searchDimensions,
    onShowQR,
    onChangeStatus,
    onDelete,
    onOpenDetails,
    getStatusLabel,
    getStatusColor,
}: Props) {
    const groups = useMemo(() => {
        const grouped = new Map<string, Retalho[]>();
        filteredRetalhos.forEach(item => {
            const key = item.filmId?.trim() || 'Película não informada';
            grouped.set(key, [...(grouped.get(key) || []), item]);
        });
        return Array.from(grouped.entries());
    }, [filteredRetalhos]);

    if (!filteredRetalhos.length) {
        return (
            <div className="rounded-[var(--radius-panel)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-raised)] px-6 py-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[var(--radius-panel)] bg-[var(--surface-muted)] text-[var(--text-muted)]"><ScissorsIcon /></div>
                <p className="mt-4 text-[1.05rem] font-semibold text-[var(--text-strong)]">Nenhum retalho encontrado</p>
                <p className="mt-2 text-[13px] text-[var(--text-muted)]">Ajuste os filtros ou cadastre um novo retalho.</p>
            </div>
        );
    }

    let resultIndex = 0;
    const mobile = (
        <div className="space-y-3 sm:hidden">
            {groups.map(([filmName, items]) => (
                <section key={filmName} className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-hairline)]">
                    <header className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3.5 py-2.5">
                        <h3 className="min-w-0 truncate text-[13px] font-semibold text-[var(--text-strong)]">{filmName}</h3>
                        <span className="shrink-0 text-[10px] font-medium text-[var(--text-muted)]">
                            {items.length} retalho{items.length === 1 ? '' : 's'}
                        </span>
                    </header>

                    {items.map((item, itemIndex) => {
                        const currentIndex = resultIndex++;
                        const fit = getFitLabel(item, currentIndex, searchDimensions);
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => onOpenDetails({ type: 'retalho', item })}
                                className={`block w-full px-3.5 py-3 text-left transition-colors active:bg-[var(--surface-muted)] ${itemIndex ? 'border-t border-[var(--border-subtle)]' : ''}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="text-[10px] font-semibold text-[var(--text-muted)]">#{item.id}</span>
                                            <span className="rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-white" style={{ backgroundColor: getStatusColor(item.status) }}>
                                                {getStatusLabel(item.status)}
                                            </span>
                                            {fit && <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${fit.className}`}>{fit.label}</span>}
                                        </div>
                                        <p className="mt-1 text-[16px] font-semibold leading-tight text-[var(--text-strong)]">
                                            {meters(item.larguraCm)} × {meters(item.comprimentoCm)} m
                                        </p>
                                        <p className={`mt-1 flex items-center gap-1 truncate text-[10px] ${item.localizacao ? 'text-[var(--text-muted)]' : 'font-semibold text-amber-600 dark:text-amber-300'}`}>
                                            <MapPin className="h-3 w-3 shrink-0" />
                                            {item.localizacao || 'Sem localização'}
                                        </p>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <p className="text-[9px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Área</p>
                                        <p className="mt-0.5 text-[12px] font-semibold text-[var(--text-body)]">{area(item)} m²</p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                                </div>
                            </button>
                        );
                    })}
                </section>
            ))}
        </div>
    );

    const grid = <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filteredRetalhos.map(item => <article key={item.id} className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-[var(--shadow-hairline)]"><span className="absolute inset-x-0 top-0 h-1 bg-[var(--brand-primary)]"/><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[1.02rem] font-semibold text-[var(--text-strong)]">{item.filmId}</p><p className="mt-1 text-[12px] text-[var(--text-muted)]">Retalho #{item.id}</p></div><span className="rounded-full px-2.5 py-1 text-[10px] uppercase text-white" style={{ backgroundColor: getStatusColor(item.status) }}>{getStatusLabel(item.status)}</span></div><div className="mt-4 rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3"><p className="text-[10px] uppercase text-[var(--text-muted)]">Área</p><p className="mt-1 text-[2rem] font-semibold text-[var(--text-strong)]">{area(item)}<span className="ml-1 text-[.95rem] text-[var(--text-muted)]">m²</span></p><p className="mt-2 text-[11px] text-[var(--text-muted)]">{item.larguraCm} × {item.comprimentoCm} cm</p></div><div className="mt-4 flex gap-2 border-t border-[var(--border-subtle)] pt-4"><button className={`${statusButton} flex-1`} onClick={() => onChangeStatus('retalho', item)}>Status</button><button className={iconButton} onClick={() => onShowQR('retalho', item)}><QrCodeIcon /></button><button className={`${iconButton} text-rose-500`} onClick={() => onDelete('retalho', item.id!)}><TrashIcon /></button></div></article>)}</div>;

    const list = <div className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)]">{filteredRetalhos.map((item, index) => <article key={item.id} className={`flex items-center gap-4 px-5 py-4 ${index ? 'border-t border-[var(--border-subtle)]' : ''}`}><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-[15px] font-semibold text-[var(--text-strong)]">{item.filmId}</p><span className="rounded-full px-2 py-0.5 text-[10px] uppercase text-white" style={{ backgroundColor: getStatusColor(item.status) }}>{getStatusLabel(item.status)}</span></div><p className="mt-1 text-[12px] text-[var(--text-muted)]">#{item.id} · {item.larguraCm} × {item.comprimentoCm} cm · {area(item)} m²</p></div><button className={statusButton} onClick={() => onChangeStatus('retalho', item)}>Status</button><button className={iconButton} onClick={() => onShowQR('retalho', item)}><QrCodeIcon /></button><button className={`${iconButton} text-rose-500`} onClick={() => onDelete('retalho', item.id!)}><TrashIcon /></button></article>)}</div>;

    return <>{mobile}<div className="hidden sm:block">{viewMode === 'grid' ? grid : list}</div></>;
}
