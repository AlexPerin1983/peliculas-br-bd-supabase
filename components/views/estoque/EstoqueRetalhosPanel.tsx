import React from 'react';
import { Retalho } from '../../../types';
import { QrCodeIcon, ScissorsIcon, TrashIcon } from './EstoqueIcons';

type EstoqueRetalhosPanelProps = {
    viewMode: 'grid' | 'list';
    filteredRetalhos: Retalho[];
    onShowQR: (type: 'retalho', item: Retalho) => void;
    onChangeStatus: (type: 'retalho', item: Retalho) => void;
    onDelete: (type: 'retalho', id: number) => void;
    getStatusLabel: (status: string) => string;
    getStatusColor: (status: string) => string;
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

const formatArea = (retalho: Retalho) =>
    retalho.areaM2?.toFixed(2) || ((retalho.larguraCm * retalho.comprimentoCm) / 10000).toFixed(2);

export default function EstoqueRetalhosPanel({
    viewMode,
    filteredRetalhos,
    onShowQR,
    onChangeStatus,
    onDelete,
    getStatusLabel,
    getStatusColor,
}: EstoqueRetalhosPanelProps) {
    if (filteredRetalhos.length === 0) {
        return (
            <div className="rounded-[var(--radius-panel)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-raised)] px-6 py-12 text-center shadow-[var(--shadow-soft)]">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[var(--radius-panel)] bg-[var(--surface-muted)] text-[var(--text-muted)]">
                    <ScissorsIcon />
                </div>
                <p className="mt-4 text-[1.05rem] font-semibold text-[var(--text-strong)]">
                    Nenhum retalho encontrado
                </p>
                <p className="mt-2 text-[13px] leading-6 text-[var(--text-muted)]">
                    Ajuste os filtros ou cadastre um novo retalho para continuar.
                </p>
            </div>
        );
    }

    if (viewMode === 'grid') {
        return (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredRetalhos.map((retalho) => (
                    <article
                        key={retalho.id}
                        className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5 shadow-[var(--shadow-hairline)] transition-all duration-200 hover:-translate-y-[1px] hover:border-[var(--brand-primary)] hover:shadow-[var(--shadow-soft)] sm:p-4"
                    >
                        <span className="absolute inset-x-0 top-0 h-1 bg-[var(--brand-primary)]" aria-hidden="true" />
                        <div className="min-w-0">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="truncate text-[1.02rem] font-semibold text-[var(--text-strong)]">
                                        {retalho.filmId}
                                    </p>
                                    <p className="mt-1 text-[11px] leading-5 text-[var(--text-muted)] sm:text-[12px]">
                                        Retalho #{retalho.id}{retalho.localizacao ? ` - ${retalho.localizacao}` : ''}
                                    </p>
                                </div>

                                <span
                                    className="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white"
                                    style={{ backgroundColor: getStatusColor(retalho.status) }}
                                >
                                    {getStatusLabel(retalho.status)}
                                </span>
                            </div>

                            <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-x-4 gap-y-3 rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
                                <div>
                                    <p className="text-[10px] font-semibold uppercase text-[var(--text-muted)]">
                                        Area
                                    </p>
                                    <div className="mt-1 flex items-baseline gap-1">
                                        <span className="text-[2.3rem] font-semibold text-[var(--text-strong)] sm:text-[2rem]">
                                            {formatArea(retalho)}
                                        </span>
                                        <span className="pb-1 text-[0.95rem] font-medium text-[var(--text-muted)]">m2</span>
                                    </div>
                                </div>

                                <div className="space-y-1 text-right">
                                    <p className="text-[11px] font-medium text-[var(--text-muted)]">
                                        {retalho.larguraCm} x {retalho.comprimentoCm} cm
                                    </p>
                                    <p className="text-[11px] font-medium text-[var(--text-soft)]">
                                        pronto para uso
                                    </p>
                                </div>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2 sm:mt-4">
                                <span className={infoChipClassName}>
                                    {retalho.larguraCm} cm largura
                                </span>
                                <span className={infoChipClassName}>
                                    {retalho.comprimentoCm} cm comprimento
                                </span>
                            </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
                            <button
                                className={`${statusActionButtonClassName} flex-1`}
                                onClick={() => onChangeStatus('retalho', retalho)}
                            >
                                Status
                            </button>
                            <div className="flex items-center gap-2.5 sm:gap-2">
                                <button
                                    className={cardIconActionButtonClassName}
                                    onClick={() => onShowQR('retalho', retalho)}
                                    title="QR Code"
                                >
                                    <QrCodeIcon />
                                </button>
                                <button
                                    className={`${cardIconActionButtonClassName} text-rose-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600`}
                                    onClick={() => onDelete('retalho', retalho.id!)}
                                    title="Excluir"
                                >
                                    <TrashIcon />
                                </button>
                            </div>
                        </div>
                    </article>
                ))}
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
            {filteredRetalhos.map((retalho, index) => (
                <article
                    key={retalho.id}
                    className={`px-3.5 py-3.5 transition-colors hover:bg-[var(--surface-muted)] sm:px-5 sm:py-4 ${index > 0 ? 'border-t border-[var(--border-subtle)]' : ''}`}
                >
                    <div className="flex items-start gap-3">
                        <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--surface-muted)] text-[var(--text-muted)] sm:flex">
                            <ScissorsIcon />
                        </div>

                        <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="truncate text-[14px] font-semibold text-[var(--text-strong)] sm:text-[15px]">
                                            {retalho.filmId}
                                        </p>
                                        <span
                                            className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white sm:text-[10px]"
                                            style={{ backgroundColor: getStatusColor(retalho.status) }}
                                        >
                                            {getStatusLabel(retalho.status)}
                                        </span>
                                    </div>

                                    <p className="mt-1 text-[11px] text-[var(--text-muted)] sm:text-[12px]">
                                        #{retalho.id} - {retalho.larguraCm} x {retalho.comprimentoCm} cm
                                    </p>
                                    {retalho.localizacao ? (
                                            <p className="mt-1 truncate text-[11px] text-[var(--text-soft)] sm:text-[12px]">
                                            {retalho.localizacao}
                                        </p>
                                    ) : null}
                                </div>

                                <div className="shrink-0 text-right">
                                    <p className="text-[9px] font-semibold uppercase text-[var(--text-muted)] sm:text-[11px]">
                                        Area
                                    </p>
                                    <p className="mt-0.5 text-[1rem] font-semibold text-[var(--text-strong)] sm:mt-1 sm:text-[1.2rem]">
                                        {formatArea(retalho)}m2
                                    </p>
                                </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-3 sm:justify-start sm:gap-2">
                                <button
                                    className={statusActionButtonClassName}
                                    onClick={() => onChangeStatus('retalho', retalho)}
                                >
                                    Status
                                </button>

                                <div className="flex items-center gap-2.5 sm:gap-2">
                                    <button
                                        className={listIconActionButtonClassName}
                                        onClick={() => onShowQR('retalho', retalho)}
                                        title="QR Code"
                                    >
                                        <QrCodeIcon />
                                    </button>
                                    <button
                                        className={`${listIconActionButtonClassName} text-rose-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600`}
                                        onClick={() => onDelete('retalho', retalho.id!)}
                                        title="Excluir"
                                    >
                                        <TrashIcon />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </article>
            ))}
        </div>
    );
}
