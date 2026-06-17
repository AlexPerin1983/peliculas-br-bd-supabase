import React from 'react';

type EstoqueRetalhoMedidaSearchProps = {
    larguraCm: string;
    comprimentoCm: string;
    onLarguraChange: (value: string) => void;
    onComprimentoChange: (value: string) => void;
    onClear: () => void;
    active: boolean;
    matchCount: number;
};

const inputClassName =
    'h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-center text-[14px] font-semibold text-[var(--text-strong)] outline-none transition-all focus:border-[var(--brand-primary)] placeholder:font-normal placeholder:text-[var(--text-muted)]';

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

    return (
        <div className="rounded-[var(--radius-panel)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3 shadow-[var(--shadow-hairline)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        Buscar retalho por medida
                    </p>
                    <p className="mt-0.5 text-[12px] text-[var(--text-soft)]">
                        Informe a peça (cm) e veja só os retalhos que cabem, do menor desperdício.
                    </p>
                </div>

                <div className="flex items-end gap-2">
                    <label className="block">
                        <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--text-muted)]">Largura (cm)</span>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={larguraCm}
                            onChange={(e) => onLarguraChange(sanitize(e.target.value))}
                            placeholder="0"
                            className={`${inputClassName} w-24`}
                        />
                    </label>
                    <span className="pb-2 text-[var(--text-muted)]">×</span>
                    <label className="block">
                        <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--text-muted)]">Comprimento (cm)</span>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={comprimentoCm}
                            onChange={(e) => onComprimentoChange(sanitize(e.target.value))}
                            placeholder="0"
                            className={`${inputClassName} w-28`}
                        />
                    </label>
                    {active && (
                        <button
                            type="button"
                            onClick={onClear}
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
                        : 'Nenhum retalho cabe nessa medida (confira o filtro de Status).'}
                </div>
            )}
        </div>
    );
}
