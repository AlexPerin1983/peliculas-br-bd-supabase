import React from 'react';
import { Columns2, Rows2 } from 'lucide-react';
import type { SeamPieceSummary } from '../../utils/CuttingOptimizer';
import type { SeamDirection, SeamOption, SeamStyle } from '../../utils/seamStrips';

interface CuttingSeamNoticeProps {
    seamPieces: SeamPieceSummary[];
    rollWidth: number;
    seamStyle: SeamStyle;
    disabled?: boolean;
    onSeamStyleChange: (style: SeamStyle) => void;
    onDirectionChange: (pieceIds: string[], direction: SeamDirection) => void;
}

const meters = (valueCm: number) => (valueCm / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const joinNatural = (items: string[]) => items.length <= 1
    ? items.join('')
    : `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;

// "emenda a 1,52 m do topo" / "emendas a 1,52 e 3,04 m da esquerda"
export const describeSeamPosition = (option: SeamOption) => {
    const positions: string[] = [];
    let offset = 0;
    option.strips.slice(0, -1).forEach(strip => {
        offset += strip;
        positions.push(meters(offset));
    });
    const side = option.direction === 'vertical' ? 'da esquerda' : 'do topo';
    return `${positions.length > 1 ? 'emendas' : 'emenda'} a ${joinNatural(positions)} m ${side}`;
};

export const describeSeamStrips = (option: SeamOption) => {
    const count = option.strips.length;
    const kind = option.direction === 'vertical' ? 'em pé' : 'deitadas';
    return `${count} faixas ${kind} de ${meters(option.stripLength)} m (${option.strips.map(meters).join(' + ')})`;
};

interface SeamGroup {
    key: string;
    piece: SeamPieceSummary;
    ids: string[];
    count: number;
}

const groupSeamPieces = (pieces: SeamPieceSummary[]): SeamGroup[] => {
    const groups = new Map<string, SeamGroup>();
    pieces.forEach(piece => {
        const key = `${piece.w}x${piece.h}|${piece.chosen.direction}`;
        const group = groups.get(key) ?? { key, piece, ids: [], count: 0 };
        group.count += 1;
        if (piece.id !== undefined) group.ids.push(String(piece.id));
        groups.set(key, group);
    });
    return Array.from(groups.values());
};

/** Peças maiores que a bobina: mostra as faixas, onde fica a emenda e deixa trocar a direção. */
export default function CuttingSeamNotice({
    seamPieces, rollWidth, seamStyle, disabled, onSeamStyleChange, onDirectionChange,
}: CuttingSeamNoticeProps) {
    if (seamPieces.length === 0) return null;
    const groups = groupSeamPieces(seamPieces);
    const total = seamPieces.length;

    return (
        <section className="mb-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-[12px] dark:border-amber-800/70 dark:bg-amber-950/20 sm:p-4" aria-label="Peças com emenda">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-100">
                        {total === 1 ? '1 peça maior que a bobina' : `${total} peças maiores que a bobina`}
                    </p>
                    <p className="mt-0.5 text-[11px] text-amber-800/90 dark:text-amber-200/80">
                        Dividida{total === 1 ? '' : 's'} em faixas com emenda de topo (sem sobrepor). O metro linear e o custo já contam as faixas.
                    </p>
                </div>
                <div className="flex shrink-0 rounded-lg bg-amber-100/80 p-0.5 text-[11px] dark:bg-amber-900/40" role="group" aria-label="Como dividir as faixas">
                    {([['full', 'Inteira + complemento'], ['equal', 'Faixas iguais']] as const).map(([style, label]) => (
                        <button
                            key={style}
                            type="button"
                            aria-pressed={seamStyle === style}
                            disabled={disabled}
                            onClick={() => onSeamStyleChange(style)}
                            className={`rounded-md px-2 py-1 font-semibold transition-colors disabled:opacity-50 ${seamStyle === style
                                ? 'bg-white text-amber-900 shadow-sm dark:bg-slate-900 dark:text-amber-100'
                                : 'text-amber-800/80 hover:text-amber-900 dark:text-amber-200/70'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <ul className="mt-3 space-y-2">
                {groups.map(({ key, piece, ids, count }) => {
                    const options = [piece.chosen, piece.alternative]
                        .filter((option): option is SeamOption => !!option)
                        .sort((a, b) => (a.direction === 'vertical' ? -1 : 1) - (b.direction === 'vertical' ? -1 : 1));
                    const saving = piece.alternative ? piece.alternative.linearCm - piece.chosen.linearCm : 0;
                    return (
                        <li key={key} className="rounded-lg border border-amber-200/80 bg-white/90 p-2.5 dark:border-amber-900/60 dark:bg-slate-900/60">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                                    {meters(piece.w)} × {meters(piece.h)} m{count > 1 ? <span className="ml-1 font-semibold text-slate-500">×{count}</span> : null}
                                </span>
                                <span className="text-[11px] font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                                    {meters(piece.chosen.linearCm * count)} m de bobina
                                </span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                                {describeSeamStrips(piece.chosen)} · {describeSeamPosition(piece.chosen)}
                            </p>

                            {options.length > 1 ? (
                                <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]" role="group" aria-label={`Direção da emenda de ${meters(piece.w)} × ${meters(piece.h)} m`}>
                                    {options.map(option => {
                                        const selected = option.direction === piece.chosen.direction;
                                        const Icon = option.direction === 'vertical' ? Columns2 : Rows2;
                                        return (
                                            <button
                                                key={option.direction}
                                                type="button"
                                                aria-pressed={selected}
                                                disabled={disabled || selected || ids.length === 0}
                                                onClick={() => onDirectionChange(ids, option.direction)}
                                                className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 font-semibold tabular-nums transition-colors ${selected
                                                    ? 'border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-600 dark:bg-amber-900/50 dark:text-amber-100'
                                                    : 'border-slate-200 bg-white text-slate-600 hover:border-amber-300 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}
                                            >
                                                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                                {option.direction === 'vertical' ? 'Vertical' : 'Horizontal'} · {meters(option.linearCm * count)} m
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="mt-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                    {piece.fitsIfRotated
                                        ? 'Com "Resp. Veio" a peça não gira. Sem ele, caberia inteira girada.'
                                        : 'Com "Resp. Veio" as faixas ficam em pé.'}
                                </p>
                            )}
                            {saving < 0 && (
                                <p className="mt-1.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
                                    As faixas somam {meters(-saving * count)} m a mais
                                    {rollWidth - Math.min(...piece.chosen.strips) >= 20
                                        ? `, mas a sobra de ${meters(rollWidth - Math.min(...piece.chosen.strips))} m ao lado da faixa mais estreita fica para outras peças. Veja o total no topo.`
                                        : '.'}
                                </p>
                            )}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
