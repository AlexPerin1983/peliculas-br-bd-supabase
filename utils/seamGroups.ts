import type { SeamInfo, SeamPieceSummary } from './CuttingOptimizer';
import type { SeamDirection } from './seamStrips';

// Peças iguais com a mesma emenda aparecem (e trocam de direção) juntas.
export interface SeamGroup {
    key: string;
    piece: SeamPieceSummary;
    ids: string[];
    count: number;
}

export const groupSeamPieces = (pieces: SeamPieceSummary[]): SeamGroup[] => {
    const groups = new Map<string, SeamGroup>();
    pieces.forEach(piece => {
        const key = `${piece.w}x${piece.h}|${piece.chosen.direction}${piece.complementFirst ? '|c' : ''}`;
        const group = groups.get(key) ?? { key, piece, ids: [], count: 0 };
        group.count += 1;
        if (piece.id !== undefined) group.ids.push(String(piece.id));
        groups.set(key, group);
    });
    return Array.from(groups.values());
};

/**
 * Comprimento do plano inteiro (cm) se cada grupo trocasse de direção.
 * Compara o gasto real: a sobra ao lado de uma faixa estreita pode receber outras peças.
 */
export const estimateSeamAlternatives = (
    groups: SeamGroup[],
    runPlan: (directions: Record<string, SeamDirection>, pieceIds: Set<string>) => number,
): Record<string, number> => {
    const totals: Record<string, number> = {};
    groups.forEach(group => {
        const alternative = group.piece.alternative;
        if (!alternative || group.ids.length === 0) return;
        const directions = Object.fromEntries(group.ids.map(id => [id, alternative.direction]));
        totals[group.key] = runPlan(directions, new Set(group.ids));
    });
    return totals;
};

// Onde a faixa vai no vidro, em poucas palavras: "em cima", "à direita"...
export const describeStripSpot = (seam: Pick<SeamInfo, 'direction' | 'index' | 'count'>): string => {
    const first = seam.index === 0;
    const last = seam.index === seam.count - 1;
    if (seam.direction === 'horizontal') return first ? 'em cima' : last ? 'embaixo' : 'no meio';
    return first ? 'à esquerda' : last ? 'à direita' : 'no meio';
};
