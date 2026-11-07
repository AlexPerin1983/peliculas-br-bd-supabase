import React from 'react';
import { EstoqueStats } from '../../../services/estoqueDb';
import { formatStockMeters } from '../../../src/lib/estoqueDimensions';
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
        label: 'Metros disponíveis',
        value: `${formatStockMeters(stats.totalMetrosDisponiveis)} m`,
        detail: 'estoque utilizável',
        tone: 'border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)]',
        accent: 'bg-[var(--brand-primary)]',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
        ),
    },
    {
        label: 'Retalhos disponíveis',
        value: stats.totalRetalhoDisponivel.toString(),
        detail: 'prontos para uso',
        tone: 'border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-muted)]',
        accent: 'bg-[var(--brand-primary)]',
        icon: <ScissorsIcon />,
    },
    {
        label: 'Consumo 30 dias',
        value: `${formatStockMeters(stats.consumoUltimos30Dias)} m`,
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

    // Só no computador: no celular o resumo fica no topo (EstoqueMobileHeader).
    return (
        <section className="hidden gap-2.5 sm:grid sm:grid-cols-2 xl:grid-cols-4">
            {items.map((item) => (
                <article
                    key={item.label}
                    className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-[var(--shadow-hairline)]"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-xs font-medium text-[var(--text-muted)]">
                                {item.label}
                            </p>
                            <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--text-strong)]">
                                {item.value}
                            </p>
                            <p className="mt-1 text-xs text-[var(--text-muted)]">
                                {item.detail}
                            </p>
                        </div>

                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] ${item.tone}`}>
                            {item.icon}
                        </span>
                    </div>
                </article>
            ))}
        </section>
    );
};

export default EstoqueStatsBar;
