import React from 'react';
import { LockKeyhole, RotateCcw, UnlockKeyhole } from 'lucide-react';
import type { Rect } from '../../utils/CuttingOptimizer';
import { describeStripSpot } from '../../utils/seamGroups';

interface CuttingMobilePieceProps {
    item: Rect;
    index: number;
    width: number;
    height: number;
    landscape: boolean;
    selected: boolean;
    locked: boolean;
    canRotate: boolean;
    onRotate: () => void;
    onToggleLock: () => void;
}

const meters = (value: number) => (value / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

/** Labels follow the displayed axes; the piece's original geometry never changes here. */
export default function CuttingMobilePiece({
    item, index, width, height, landscape, selected, locked, canRotate, onRotate, onToggleLock,
}: CuttingMobilePieceProps) {
    const narrow = width < 86;
    const showAxisLabels = width >= 34 && height >= 86;
    const showInlineSize = !showAxisLabels && width >= 94 && height >= 40;
    const showActions = selected && width >= 116 && height >= 116;

    return (
        <div className="cutting-piece-art sm:hidden" data-narrow={narrow}>
            <span className="cutting-piece-number" style={{ fontSize: narrow ? 17 : Math.min(62, Math.max(24, Math.min(width, height) * 0.46)) }}>
                {index + 1}
            </span>
            {showAxisLabels && <>
                <span className="cutting-measure-width">{meters(landscape ? item.h : item.w)}</span>
                <span className="cutting-measure-height">{meters(landscape ? item.w : item.h)}</span>
            </>}
            {showInlineSize && <span className="cutting-measure-inline">{meters(item.w)} × {meters(item.h)}</span>}
            {item.seam && width >= 30 && height >= 24 && (
                <span className="cutting-seam-tag" title={`Faixa ${item.seam.index + 1}/${item.seam.count}: vai ${describeStripSpot(item.seam)} no vidro (emenda de topo)`}>
                    {width >= 64 ? 'faixa ' : ''}{item.seam.index + 1}/{item.seam.count}
                </span>
            )}
            {locked && !showActions && <LockKeyhole className="cutting-lock-mark" size={14} aria-label="Posição travada" />}
            {showActions && <div className="cutting-inline-actions">
                <button type="button" aria-label="Girar peça no mapa" disabled={!canRotate}
                    title={locked ? 'Destrave a peça para girar' : !canRotate ? 'A peça não cabe girada nesta bobina' : 'Girar peça 90°'}
                    onClick={event => { event.stopPropagation(); onRotate(); }}>
                    <RotateCcw size={21} aria-hidden="true" />
                </button>
                <button type="button" className="cutting-inline-lock" aria-label={locked ? 'Destravar peça no mapa' : 'Travar peça no mapa'}
                    onClick={event => { event.stopPropagation(); onToggleLock(); }}>
                    {locked ? <UnlockKeyhole size={21} aria-hidden="true" /> : <LockKeyhole size={21} aria-hidden="true" />}
                </button>
            </div>}
        </div>
    );
}
