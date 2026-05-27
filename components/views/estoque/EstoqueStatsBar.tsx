import React from 'react';
import { EstoqueStats } from '../../../services/estoqueDb';
import { PackageIcon, ScissorsIcon } from './EstoqueIcons';

interface EstoqueStatsBarProps {
    stats: EstoqueStats;
}

const statCards = (stats: EstoqueStats) => [
    {
        label: 'Bobinas ativas',
        value: stats.totalBobinasAtivas.toString(),
        detail: 'em acompanhamento',
        tone: 'border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)]',
        accent: 'bg-[var(--brand-primary)]',
        icon: <PackageIcon />,
    },
    {
        label: 'Metros disponiveis',
        value: `${stats.totalMetrosDisponiveis.toFixed(1)}m`,
        detail: 'estoque utilizavel',
        tone: 'border border-[var(--border-subtle)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]',
        accent: 'bg-[var(--brand-primary)]',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
        ),
    },
    {
        label: 'Retalhos disponiveis',
        value: stats.totalRetalhoDisponivel.toString(),
        detail: 'prontos para uso',
        tone: 'border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)]',
        accent: 'bg-[var(--brand-primary)]',
        icon: <ScissorsIcon />,
    },
    {
        label: 'Consumo 30 dias',
        value: `${stats.consumoUltimos30Dias.toFixed(1)}m`,
        detail: 'ritmo recente',
        tone: 'border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)]',
        accent: 'bg-[var(--brand-primary)]',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20V10" />
                <path d="M18 20V4" />
                <path d="M6 20v-4" />
            </svg>
        ),
    },
];

const EstoqueStatsBar: React.FC<EstoqueStatsBarProps> = ({ stats }) => {
    const items = statCards(stats);

    return (
        <>
            <section className="sm:hidden">
                <div className="flex items-center justify-between gap-3 px-1">
                    <p className="ui-kicker">
                        Resumo rapido
                    </p>
                    <p className="text-[11px] font-medium text-[var(--text-muted)]">
                        Estoque ao vivo
                    </p>
                </div>

                <div className="mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {items.map((item) => (
                        <article
                            key={item.label}
                            className="relative min-w-[138px] overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3 shadow-[var(--shadow-hairline)]"
                        >
                            <span className={`absolute inset-x-0 top-0 h-1 ${item.accent}`} aria-hidden="true" />
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-semibold uppercase text-[var(--text-soft)]">
                                        {item.label}
                                    </p>
                                    <p className="mt-2 text-[1.2rem] font-semibold text-[var(--text-strong)]">
                                        {item.value}
                                    </p>
                                </div>

                                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] ${item.tone}`}>
                                    {item.icon}
                                </span>
                            </div>

                            <p className="mt-2 text-[11px] leading-5 text-[var(--text-muted)]">
                                {item.detail}
                            </p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="hidden gap-2.5 sm:grid sm:grid-cols-2 xl:grid-cols-4">
                {items.map((item) => (
                    <article
                        key={item.label}
                        className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5 shadow-[var(--shadow-hairline)] transition-all duration-200 hover:-translate-y-px hover:shadow-[var(--shadow-soft)]"
                    >
                        <span className={`absolute inset-x-0 top-0 h-1 ${item.accent}`} aria-hidden="true" />
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[11px] font-semibold uppercase text-[var(--text-muted)]">
                                    {item.label}
                                </p>
                                <p className="mt-2 text-[1.45rem] font-semibold text-[var(--text-strong)]">
                                    {item.value}
                                </p>
                                <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                                    {item.detail}
                                </p>
                            </div>

                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ${item.tone}`}>
                                {item.icon}
                            </span>
                        </div>
                    </article>
                ))}
            </section>
        </>
    );
};

export default EstoqueStatsBar;
