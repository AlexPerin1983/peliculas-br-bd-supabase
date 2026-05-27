import React from 'react';
import { Bobina } from '../../../types';
import { PackageIcon, QrCodeIcon, TrashIcon } from './EstoqueIcons';

type EstoqueBobinasPanelProps = {
    viewMode: 'grid' | 'list';
    filteredBobinas: Bobina[];
    onShowQR: (type: 'bobina', item: Bobina) => void;
    onChangeStatus: (type: 'bobina', item: Bobina) => void;
    onDelete: (type: 'bobina', id: number) => void;
    getStatusLabel: (status: string) => string;
    getStatusColor: (status: string) => string;
};

const getRemainingRatio = (bobina: Bobina) => {
    if (!bobina.comprimentoTotalM) return 0;
    return Math.max(0, Math.min(1, bobina.comprimentoRestanteM / bobina.comprimentoTotalM));
};

const getProgressTone = (ratio: number) => {
    if (ratio > 0.5) return 'bg-emerald-500';
    if (ratio > 0.2) return 'bg-amber-500';
    return 'bg-rose-500';
};

const actionButtonClassName =
    'inline-flex h-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-[12px] font-semibold text-[var(--text-body)] transition-all hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)]';

const statusActionButtonClassName =
    'inline-flex h-10 min-w-[106px] items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-4 text-[12px] font-semibold text-[var(--text-body)] transition-all hover:bg-[var(--surface-muted)] hover:text-[var(--text-strong)] sm:h-9 sm:min-w-0 sm:px-3';

const cardIconActionButtonClassName =
    'inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)] transition-all hover:bg-[var(--surface)] hover:text-[var(--text-strong)] sm:h-9 sm:w-9';

const listIconActionButtonClassName =
    'inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)] transition-all hover:bg-[var(--surface)] hover:text-[var(--text-strong)] sm:h-9 sm:w-9';

const infoChipClassName =
    'rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-body)]';

export default function EstoqueBobinasPanel({
    viewMode,
    filteredBobinas,
    onShowQR,
    onChangeStatus,
    onDelete,
    getStatusLabel,
    getStatusColor,
}: EstoqueBobinasPanelProps) {
    if (filteredBobinas.length === 0) {
        return (
            <div className="rounded-[var(--radius-panel)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-raised)] px-6 py-12 text-center shadow-[var(--shadow-soft)]">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[var(--radius-panel)] bg-[var(--surface-muted)] text-[var(--text-muted)]">
                    <PackageIcon />
                </div>
                <p className="mt-4 text-[1.05rem] font-semibold text-[var(--text-strong)]">
                    Nenhuma bobina encontrada
                </p>
                <p className="mt-2 text-[13px] leading-6 text-[var(--text-muted)]">
                    Ajuste os filtros ou cadastre uma nova bobina para continuar.
                </p>
            </div>
        );
    }

    if (viewMode === 'grid') {
        return (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredBobinas.map((bobina) => {
                    const remainingRatio = getRemainingRatio(bobina);
                    const usedPercentage = ((1 - remainingRatio) * 100).toFixed(0);

                    return (
                        <article
                            key={bobina.id}
                            className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5 shadow-[var(--shadow-hairline)] transition-all duration-200 hover:-translate-y-[1px] hover:border-[var(--brand-primary)] hover:shadow-[var(--shadow-soft)] sm:p-4"
                        >
                            <span className="absolute inset-x-0 top-0 h-1 bg-[var(--brand-primary)]" aria-hidden="true" />
                            <div className="min-w-0">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-[1.02rem] font-semibold text-[var(--text-strong)]">
                                            {bobina.filmId}
                                        </p>
                                        <p className="mt-1 text-[11px] leading-5 text-[var(--text-muted)] sm:text-[12px]">
                                            Bobina #{bobina.id}{bobina.localizacao ? ` - ${bobina.localizacao}` : ''}
                                        </p>
                                    </div>

                                    <span
                                        className="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white"
                                        style={{ backgroundColor: getStatusColor(bobina.status) }}
                                    >
                                        {getStatusLabel(bobina.status)}
                                    </span>
                                </div>

                                <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-x-4 gap-y-3 rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
                                    <div>
                                        <p className="text-[10px] font-semibold uppercase text-[var(--text-muted)]">
                                            Disponivel
                                        </p>
                                        <div className="mt-1 flex items-baseline gap-1">
                                            <span className="text-[2.3rem] font-semibold text-[var(--text-strong)] sm:text-[2rem]">
                                                {bobina.comprimentoRestanteM.toFixed(1)}
                                            </span>
                                            <span className="pb-1 text-[0.95rem] font-medium text-[var(--text-muted)]">m</span>
                                        </div>
                                    </div>

                                    <div className="space-y-1 text-right">
                                        <p className="text-[11px] font-medium text-[var(--text-muted)]">
                                            {bobina.comprimentoTotalM}m total
                                        </p>
                                        <p className="text-[11px] font-medium text-[var(--text-soft)]">
                                            {usedPercentage}% usado
                                        </p>
                                    </div>

                                    <div className="col-span-2 h-2.5 overflow-hidden rounded-full bg-[var(--surface)] shadow-[var(--shadow-hairline)]">
                                        <div
                                            className={`h-full rounded-full transition-all ${getProgressTone(remainingRatio)}`}
                                            style={{ width: `${remainingRatio * 100}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2 sm:mt-4">
                                    <span className={infoChipClassName}>
                                        {bobina.larguraCm} cm
                                    </span>
                                    {bobina.fornecedor ? (
                                        <span className={infoChipClassName}>
                                            {bobina.fornecedor}
                                        </span>
                                    ) : null}
                                    {bobina.lote ? (
                                        <span className={infoChipClassName}>
                                            Lote {bobina.lote}
                                        </span>
                                    ) : null}
                                </div>
                            </div>

                            <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
                                <button
                                    className={`${statusActionButtonClassName} flex-1`}
                                    onClick={() => onChangeStatus('bobina', bobina)}
                                >
                                    Status
                                </button>
                                <div className="flex items-center gap-2.5 sm:gap-2">
                                    <button
                                        className={cardIconActionButtonClassName}
                                        onClick={() => onShowQR('bobina', bobina)}
                                        title="QR Code"
                                    >
                                        <QrCodeIcon />
                                    </button>
                                    <button
                                        className={`${cardIconActionButtonClassName} text-rose-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600`}
                                        onClick={() => onDelete('bobina', bobina.id!)}
                                        title="Excluir"
                                    >
                                        <TrashIcon />
                                    </button>
                                </div>
                            </div>
                        </article>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
            {filteredBobinas.map((bobina, index) => {
                const remainingRatio = getRemainingRatio(bobina);

                return (
                    <article
                        key={bobina.id}
                        className={`px-3.5 py-3.5 transition-colors hover:bg-[var(--surface-muted)] sm:px-5 sm:py-4 ${index > 0 ? 'border-t border-[var(--border-subtle)]' : ''}`}
                    >
                        <div className="flex items-start gap-3">
                            <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--surface-muted)] text-[var(--text-muted)] sm:flex">
                                <PackageIcon />
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="truncate text-[14px] font-semibold text-[var(--text-strong)] sm:text-[15px]">
                                                {bobina.filmId}
                                            </p>
                                            <span
                                                className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white sm:text-[10px]"
                                                style={{ backgroundColor: getStatusColor(bobina.status) }}
                                            >
                                                {getStatusLabel(bobina.status)}
                                            </span>
                                        </div>

                                        <p className="mt-1 text-[11px] text-[var(--text-muted)] sm:text-[12px]">
                                            #{bobina.id} - {bobina.larguraCm} cm - {bobina.comprimentoRestanteM.toFixed(1)}m livres
                                        </p>
                                        {bobina.localizacao ? (
                                            <p className="mt-1 truncate text-[11px] text-[var(--text-soft)] sm:text-[12px]">
                                                {bobina.localizacao}
                                            </p>
                                        ) : null}
                                    </div>

                                    <div className="shrink-0 text-right">
                                        <p className="text-[9px] font-semibold uppercase text-[var(--text-muted)] sm:text-[11px]">
                                            Restante
                                        </p>
                                        <p className="mt-0.5 text-[1rem] font-semibold text-[var(--text-strong)] sm:mt-1 sm:text-[1.2rem]">
                                            {bobina.comprimentoRestanteM.toFixed(1)}m
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0 flex-1">
                                        <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                                            <div
                                                className={`h-full rounded-full transition-all ${getProgressTone(remainingRatio)}`}
                                                style={{ width: `${remainingRatio * 100}%` }}
                                            />
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-medium text-[var(--text-muted)] sm:text-[11px]">
                                            <span>{bobina.comprimentoTotalM}m total</span>
                                            {bobina.fornecedor ? <span>- {bobina.fornecedor}</span> : null}
                                            {bobina.lote ? <span>- Lote {bobina.lote}</span> : null}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between gap-3 sm:justify-start sm:gap-2">
                                        <button
                                            className={statusActionButtonClassName}
                                            onClick={() => onChangeStatus('bobina', bobina)}
                                        >
                                            Status
                                        </button>

                                        <div className="flex items-center gap-2.5 sm:gap-2">
                                            <button
                                                className={listIconActionButtonClassName}
                                                onClick={() => onShowQR('bobina', bobina)}
                                                title="QR Code"
                                            >
                                                <QrCodeIcon />
                                            </button>
                                            <button
                                                className={`${listIconActionButtonClassName} text-rose-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600`}
                                                onClick={() => onDelete('bobina', bobina.id!)}
                                                title="Excluir"
                                            >
                                                <TrashIcon />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </article>
                );
            })}
        </div>
    );
}
