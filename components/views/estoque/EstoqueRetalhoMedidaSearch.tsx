import React, { useRef, useState } from 'react';
import { ChevronDown, Ruler } from 'lucide-react';

type EstoqueRetalhoMedidaSearchProps = {
    larguraCm: string;
    comprimentoCm: string;
    onLarguraChange: (value: string) => void;
    onComprimentoChange: (value: string) => void;
    onClear: () => void;
    active: boolean;
    matchCount: number;
};

// 16px no campo: o iPhone não dá zoom ao tocar.
const inputClassName =
    'h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-center font-semibold text-[var(--text-strong)] outline-none transition-all focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-blue-500/10 placeholder:font-normal placeholder:text-[var(--text-muted)]';

export default function EstoqueRetalhoMedidaSearch({
    larguraCm,
    comprimentoCm,
    onLarguraChange,
    onComprimentoChange,
    onClear,
    active,
    matchCount,
}: EstoqueRetalhoMedidaSearchProps) {
    const sanitize = (value: string) => value.replace(/[^\d.,]/g, '');
    // No celular começa recolhida, para a lista ficar à vista (aberta enquanto houver medida).
    const [open, setOpen] = useState(false);
    const expanded = open || active || Boolean(larguraCm || comprimentoCm);
    const larguraRef = useRef<HTMLInputElement>(null);

    const toggle = () => {
        const next = !expanded;
        setOpen(next);
        if (next) window.setTimeout(() => larguraRef.current?.focus(), 50);
    };

    return (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 shadow-[var(--shadow-hairline)] sm:rounded-[var(--radius-panel)] sm:bg-[var(--surface-raised)]">
            <button type="button" onClick={toggle} aria-expanded={expanded} className="flex w-full items-center gap-2.5 text-left sm:hidden">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-[var(--brand-primary)]">
                    <Ruler className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-[var(--text-strong)]">Buscar retalho por medida</span>
                    <span className="block truncate text-xs text-[var(--text-muted)]">
                        {expanded ? 'Informe a peça em centímetros' : 'Ache o retalho que cabe na peça'}
                    </span>
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--text-soft)] transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>

            <div className={`${expanded ? 'mt-3' : 'hidden'} flex-col gap-3 sm:mt-0 sm:flex sm:flex-row sm:items-end ${expanded ? 'flex' : ''}`}>
                <div className="hidden min-w-0 flex-1 sm:block">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        Buscar retalho por medida
                    </p>
                    <p className="mt-0.5 text-[12px] text-[var(--text-soft)]">
                        Informe a peça (cm) e veja só os retalhos que cabem, do menor desperdício.
                    </p>
                </div>

                <div className="flex items-end gap-2">
                    <label className="block min-w-0 flex-1 sm:flex-none">
                        <span className="mb-1 block text-[11px] font-semibold uppercase text-[var(--text-muted)] sm:text-[10px]">Largura (cm)</span>
                        <input
                            ref={larguraRef}
                            type="text"
                            inputMode="decimal"
                            value={larguraCm}
                            onChange={(e) => onLarguraChange(sanitize(e.target.value))}
                            placeholder="0"
                            style={{ fontSize: 16 }}
                            className={`${inputClassName} sm:w-24`}
                        />
                    </label>
                    <span className="pb-2.5 text-[var(--text-muted)]">×</span>
                    <label className="block min-w-0 flex-1 sm:flex-none">
                        <span className="mb-1 block text-[11px] font-semibold uppercase text-[var(--text-muted)] sm:text-[10px]">Comprimento (cm)</span>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={comprimentoCm}
                            onChange={(e) => onComprimentoChange(sanitize(e.target.value))}
                            placeholder="0"
                            style={{ fontSize: 16 }}
                            className={`${inputClassName} sm:w-28`}
                        />
                    </label>
                    {active && (
                        <button
                            type="button"
                            onClick={() => { onClear(); setOpen(false); }}
                            className="h-10 shrink-0 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-[12px] font-semibold text-[var(--text-body)] transition-all hover:bg-[var(--surface-muted)]"
                        >
                            Limpar
                        </button>
                    )}
                </div>
            </div>

            {active && (
                <div className={`mt-3 rounded-[var(--radius-control)] px-3 py-2 text-[12px] font-semibold ${matchCount > 0
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                    }`}>
                    {matchCount > 0
                        ? `${matchCount} retalho${matchCount > 1 ? 's' : ''} no estoque cabe${matchCount > 1 ? 'm' : ''} nessa medida.`
                        : 'Nenhum retalho cabe nessa medida (confira o filtro de status).'}
                </div>
            )}
        </div>
    );
}
