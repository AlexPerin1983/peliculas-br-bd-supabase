import React from 'react';
import type { SeamPieceSummary } from '../../utils/CuttingOptimizer';
import { hasSeamComplement, type SeamDirection, type SeamOption, type SeamStyle } from '../../utils/seamStrips';
import { groupSeamPieces } from '../../utils/seamGroups';

interface CuttingSeamNoticeProps {
    seamPieces: SeamPieceSummary[];
    rollWidth: number;
    // Comprimento do plano atual e, por grupo, do plano com a outra direção (cm).
    planTotalCm?: number;
    alternativeTotals?: Record<string, number>;
    // Custo por metro linear da película (para mostrar a diferença em R$).
    pricePerMeter?: number;
    seamStyle: SeamStyle;
    disabled?: boolean;
    onSeamStyleChange: (style: SeamStyle) => void;
    onDirectionChange: (pieceIds: string[], direction: SeamDirection) => void;
    // Lado da faixa do complemento (primeiro = em cima / à esquerda).
    onComplementSideChange?: (pieceIds: string[], complementFirst: boolean) => void;
}

const meters = (valueCm: number) => (valueCm / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const currency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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

/** Desenho proporcional do vidro com as faixas e a linha da emenda tracejada. */
export function SeamPreview({ w, h, option, size = 44, label }: { w: number; h: number; option: SeamOption; size?: number; label?: string }) {
    const scale = size / Math.max(w, h);
    const width = Math.max(10, w * scale);
    const height = Math.max(10, h * scale);
    const seams: number[] = [];
    let offset = 0;
    option.strips.slice(0, -1).forEach(strip => {
        offset += strip;
        seams.push(offset * scale);
    });

    return (
        <svg
            width={width + 2}
            height={height + 2}
            viewBox={`-1 -1 ${width + 2} ${height + 2}`}
            className="shrink-0 overflow-visible"
            {...(label === ''
                ? { 'aria-hidden': true }
                : { role: 'img', 'aria-label': label ?? `${describeSeamStrips(option)}, ${describeSeamPosition(option)}` })}
        >
            <rect x="0" y="0" width={width} height={height} rx="1.5" className="fill-sky-100 stroke-sky-500 dark:fill-sky-900/60 dark:stroke-sky-400" strokeWidth="1" />
            {seams.map(position => (option.direction === 'vertical'
                ? <line key={position} x1={position} y1={-1} x2={position} y2={height + 1} className="stroke-amber-500" strokeWidth="1.6" strokeDasharray="3 2" />
                : <line key={position} x1={-1} y1={position} x2={width + 1} y2={position} className="stroke-amber-500" strokeWidth="1.6" strokeDasharray="3 2" />))}
        </svg>
    );
}

/** Peças maiores que a bobina: mostra as faixas, onde fica a emenda e o gasto de cada direção. */
export default function CuttingSeamNotice({
    seamPieces, rollWidth, planTotalCm, alternativeTotals, pricePerMeter, seamStyle, disabled, onSeamStyleChange, onDirectionChange,
    onComplementSideChange,
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
                    const alternativeTotal = alternativeTotals?.[key];
                    // Com o plano da outra direção calculado, compara o plano inteiro; senão, só as faixas.
                    const comparePlans = planTotalCm !== undefined && alternativeTotal !== undefined;
                    const options = [piece.chosen, piece.alternative]
                        .filter((option): option is SeamOption => !!option)
                        .map(option => {
                            const chosen = option.direction === piece.chosen.direction;
                            const totalCm = comparePlans
                                ? (chosen ? planTotalCm! : alternativeTotal!)
                                : option.linearCm * count;
                            return { option, chosen, totalCm };
                        })
                        .sort((a, b) => (a.option.direction === 'vertical' ? -1 : 1) - (b.option.direction === 'vertical' ? -1 : 1));
                    const cheapestCm = Math.min(...options.map(item => item.totalCm));

                    return (
                        <li key={key} className="rounded-lg border border-amber-200/80 bg-white/90 p-2.5 dark:border-amber-900/60 dark:bg-slate-900/60">
                            <div className="flex items-start gap-2.5">
                                {options.length === 1 && <SeamPreview w={piece.w} h={piece.h} option={piece.chosen} />}
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                        <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                                            {meters(piece.w)} × {meters(piece.h)} m{count > 1 ? <span className="ml-1 font-semibold text-slate-500">×{count}</span> : null}
                                        </span>
                                        <span className="text-[11px] font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                                            faixas: {meters(piece.chosen.linearCm * count)} m
                                        </span>
                                    </div>
                                    <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                                        {describeSeamStrips(piece.chosen)} · {describeSeamPosition(piece.chosen)}
                                    </p>
                                    {options.length === 1 && (
                                        <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                            {piece.fitsIfRotated
                                                ? 'Com "Resp. Veio" a peça não gira. Sem ele, caberia inteira girada.'
                                                : 'Com "Resp. Veio" as faixas ficam em pé.'}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {options.length > 1 && (
                                <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]" role="group" aria-label={`Direção da emenda de ${meters(piece.w)} × ${meters(piece.h)} m`}>
                                    {options.map(({ option, chosen, totalCm }) => {
                                        const extraCm = totalCm - cheapestCm;
                                        const label = option.direction === 'vertical' ? 'Vertical' : 'Horizontal';
                                        return (
                                            <button
                                                key={option.direction}
                                                type="button"
                                                aria-pressed={chosen}
                                                aria-label={`${label} · ${comparePlans ? 'plano' : 'faixas'} ${meters(totalCm)} m`}
                                                disabled={disabled || chosen || ids.length === 0}
                                                onClick={() => onDirectionChange(ids, option.direction)}
                                                className={`flex items-center gap-2 rounded-lg border p-1.5 text-left transition-colors ${chosen
                                                    ? 'border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-600 dark:bg-amber-900/50 dark:text-amber-100'
                                                    : 'border-slate-200 bg-white text-slate-600 hover:border-amber-300 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}
                                            >
                                                <SeamPreview w={piece.w} h={piece.h} option={option} size={34} label="" />
                                                <span className="min-w-0 leading-tight">
                                                    <span className="block font-bold">{label}</span>
                                                    <span className="block tabular-nums">{comparePlans ? 'plano' : 'faixas'} {meters(totalCm)} m</span>
                                                    <span className={`block text-[10px] font-semibold tabular-nums ${extraCm >= 1
                                                        ? 'text-amber-700 dark:text-amber-300'
                                                        : 'text-emerald-700 dark:text-emerald-400'}`}>
                                                        {extraCm >= 1 ? <>
                                                            <span className="whitespace-nowrap">+{meters(extraCm)} m</span>
                                                            {pricePerMeter ? <> <span className="whitespace-nowrap">+{currency((extraCm / 100) * pricePerMeter)}</span></> : null}
                                                        </> : options.every(item => Math.abs(item.totalCm - cheapestCm) < 1) ? 'mesmo gasto' : 'mais econômica'}
                                                    </span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            {onComplementSideChange && seamStyle === 'full' && ids.length > 0 && hasSeamComplement(piece.chosen.strips) && (() => {
                                const strips = piece.chosen.strips;
                                const complementWidth = piece.complementFirst ? strips[0] : strips[strips.length - 1];
                                const sides = piece.chosen.direction === 'horizontal'
                                    ? ['em cima', 'embaixo'] as const
                                    : ['à esquerda', 'à direita'] as const;
                                return (
                                    <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px]">
                                        <span className="font-medium text-slate-600 dark:text-slate-300">
                                            Faixa estreita ({meters(complementWidth)} m)
                                        </span>
                                        <span className="flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800" role="group" aria-label={`Lado da faixa estreita de ${meters(piece.w)} × ${meters(piece.h)} m`}>
                                            {sides.map((side, index) => {
                                                const first = index === 0;
                                                const selected = piece.complementFirst === first;
                                                return (
                                                    <button
                                                        key={side}
                                                        type="button"
                                                        aria-pressed={selected}
                                                        disabled={disabled || selected}
                                                        onClick={() => onComplementSideChange(ids, first)}
                                                        className={`rounded-md px-2 py-1 font-semibold transition-colors ${selected
                                                            ? 'bg-white text-amber-900 shadow-sm dark:bg-slate-950 dark:text-amber-100'
                                                            : 'text-slate-500 hover:text-slate-700 disabled:opacity-60 dark:text-slate-400'}`}
                                                    >
                                                        {side}
                                                    </button>
                                                );
                                            })}
                                        </span>
                                    </div>
                                );
                            })()}
                            {options.length > 1 && comparePlans && options.some(({ option }) => Math.min(...option.strips) <= rollWidth - 20) && (
                                <p className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                                    O plano conta a sobra ao lado da faixa mais estreita, que recebe outras peças.
                                </p>
                            )}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
