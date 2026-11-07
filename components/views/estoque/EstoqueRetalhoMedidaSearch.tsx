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
    'h-10 w-full rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-center tabular-nums text-[var(--text-strong)] outline-none transition-colors focus:border-[var(--brand-primary)] placeholder:text-[var(--text-soft)]';

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
                    <p className="text-sm font-semibold text-[var(--text-strong)]">
                        Buscar retalho por medida
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        Informe a peça em cm e veja só os retalhos que cabem, do menor desperdício
                    </p>
                </div>

                <div className="flex items-end gap-2">
                    <label className="block">
                        <span className="mb-1 block text-xs text-[var(--text-muted)]">Largura (cm)</span>
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
                        <span className="mb-1 block text-xs text-[var(--text-muted)]">Comprimento (cm)</span>
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
                            className="h-10 shrink-0 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 text-[var(--text-body)] transition-colors hover:bg-[var(--surface-muted)]"
                        >
                            <span className="text-xs font-medium">Limpar</span>
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
