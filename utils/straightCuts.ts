import type { Rect } from './CuttingOptimizer';

type Box = Pick<Rect, 'x' | 'y' | 'w' | 'h'>;

const EPSILON = 0.01;

/**
 * Separa as peças em grupos por um corte reto (de ponta a ponta da região).
 * Retorna null quando nenhuma linha reta nesse eixo separa as peças.
 */
const splitByAxis = <T extends Box>(items: T[], axis: 'x' | 'y'): T[][] | null => {
    const size = axis === 'y' ? 'h' : 'w';
    const sorted = [...items].sort((a, b) => a[axis] - b[axis]);
    const groups: T[][] = [];
    let current: T[] = [];
    let currentEnd = -Infinity;

    sorted.forEach(item => {
        if (current.length > 0 && item[axis] >= currentEnd - EPSILON) {
            groups.push(current);
            current = [];
        }
        current.push(item);
        currentEnd = Math.max(currentEnd, item[axis] + item[size]);
    });
    if (current.length > 0) groups.push(current);

    return groups.length > 1 ? groups : null;
};

/**
 * Indica se o plano pode ser cortado só com linhas retas de ponta a ponta
 * (corte guilhotina): atravessa a bobina, separa as tiras e assim por diante.
 * Tenta primeiro o corte atravessado, que é como a bobina é desenrolada.
 */
export const isStraightCuttable = (items: Box[]): boolean => {
    if (items.length <= 1) return true;
    const groups = splitByAxis(items, 'y') ?? splitByAxis(items, 'x');
    return !!groups && groups.every(isStraightCuttable);
};

export interface CutLine {
    // 'across': atravessa a largura (linha horizontal no mapa); 'along': ao comprido.
    direction: 'across' | 'along';
    // Posição da linha em cm (y para 'across', x para 'along').
    position: number;
    // Trecho que a linha percorre, em cm, no outro eixo.
    from: number;
    to: number;
    // 1 = corte principal da bobina; 2+ = cortes dentro de uma faixa/tira.
    level: number;
    // Ordem dos cortes principais, de cima para baixo (só no nível 1).
    order?: number;
    // Corte final, onde a bobina é separada do rolo.
    isEnd?: boolean;
}

interface CutNode {
    group: Box[];
    region: Box;
    // Parte da região que segue para os próximos cortes (igual à região, salvo com shrink).
    area: Box;
    level: number;
    // Presente quando a região é dividida por cortes retos.
    split: { axis: 'x' | 'y'; cuts: number[] } | null;
}

/**
 * Percorre o plano como uma sequência de cortes retos, da bobina inteira até
 * cada peça. Os cortes ficam no espaço entre as peças, em centímetro inteiro.
 * Retorna false se alguma região não pode ser separada com linha reta.
 */
const walkStraightCuts = (
    items: Box[],
    root: Box,
    visit: (node: CutNode) => void,
    // Opcional: recorta a região antes de dividi-la (ex.: tirar a sobra da borda primeiro).
    shrink?: (group: Box[], region: Box) => Box,
): boolean => {
    const walk = (group: Box[], outer: Box, level: number): boolean => {
        const region = shrink ? shrink(group, outer) : outer;
        if (group.length <= 1) {
            visit({ group, region: outer, area: region, level, split: null });
            return true;
        }
        const byY = splitByAxis(group, 'y');
        const groups = byY ?? splitByAxis(group, 'x');
        if (!groups) return false;

        const axis = byY ? 'y' : 'x';
        const size = axis === 'y' ? 'h' : 'w';
        const cuts = groups.slice(0, -1).map((current, index) => {
            const end = Math.max(...current.map(item => item[axis] + item[size]));
            const nextStart = Math.min(...groups[index + 1].map(item => item[axis]));
            // Centímetro inteiro para medir com a trena, sem sair do espaço entre as peças.
            const middle = (end + nextStart) / 2;
            const rounded = Math.round(middle);
            return rounded >= end - EPSILON && rounded <= nextStart + EPSILON ? rounded : middle;
        });
        visit({ group, region: outer, area: region, level, split: { axis, cuts } });

        const bounds = [region[axis], ...cuts, region[axis] + region[size]];
        return groups.every((subgroup, index) => walk(subgroup, axis === 'y'
            ? { x: region.x, w: region.w, y: bounds[index], h: bounds[index + 1] - bounds[index] }
            : { y: region.y, h: region.h, x: bounds[index], w: bounds[index + 1] - bounds[index] }, level + 1));
    };
    return items.length > 0 && walk(items, root, 1);
};

/**
 * Linhas de corte de um plano feito só com cortes retos, no meio do espaço
 * entre as peças. Retorna null se o plano não pode ser cortado assim.
 */
export const buildCutLines = (items: Box[], rollWidth: number, totalHeight: number): CutLine[] | null => {
    const lines: CutLine[] = [];
    const cuttable = walkStraightCuts(items, { x: 0, y: 0, w: rollWidth, h: totalHeight }, ({ region, level, split }) => {
        split?.cuts.forEach(position => lines.push(split.axis === 'y'
            ? { direction: 'across', position, from: region.x, to: region.x + region.w, level }
            : { direction: 'along', position, from: region.y, to: region.y + region.h, level }));
    });

    if (!cuttable) return null;

    lines.push({ direction: 'across', position: totalHeight, from: 0, to: rollWidth, level: 1, isEnd: true });
    lines
        .filter(line => line.level === 1 && line.direction === 'across')
        .sort((a, b) => a.position - b.position)
        .forEach((line, index) => { line.order = index + 1; });

    return lines;
};

export interface CutBand {
    // Número da faixa, de cima para baixo.
    number: number;
    start: number;
    end: number;
    // Quanto medir com a trena a partir da ponta deixada pelo corte anterior (cm).
    height: number;
    // Índices (base 1, na ordem do plano) das peças que saem desta faixa.
    pieceNumbers: number[];
}

/** Faixas entre os cortes que atravessam a bobina, com a altura de cada uma. */
export const getCutBands = (lines: CutLine[], items: Box[]): CutBand[] => {
    const cuts = lines
        .filter(line => line.level === 1 && line.direction === 'across')
        .map(line => line.position)
        .sort((a, b) => a - b);

    return cuts.map((end, index) => {
        const start = index === 0 ? 0 : cuts[index - 1];
        const pieceNumbers = items
            .map((item, itemIndex) => ({ item, number: itemIndex + 1 }))
            .filter(({ item }) => item.y >= start - EPSILON && item.y < end - EPSILON)
            .map(({ number }) => number)
            .sort((a, b) => a - b);
        return { number: index + 1, start, end, height: end - start, pieceNumbers };
    });
};

/** "1, 2, 3, 5" → "1–3, 5". */
export const formatPieceRanges = (numbers: number[]) => {
    const ranges: string[] = [];
    let rangeStart = numbers[0];
    numbers.forEach((number, index) => {
        const next = numbers[index + 1];
        if (next === number + 1) return;
        ranges.push(rangeStart === number ? `${number}` : `${rangeStart}–${number}`);
        rangeStart = next;
    });
    return ranges.join(', ');
};

export interface Remnant {
    // Posição e medidas no plano, em cm (w atravessa a bobina, h vai ao comprido).
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface RemnantOptions {
    // Espaço entre peças: metade fica como folga da peça vizinha, não entra no retalho.
    gap?: number;
    // Menor lado que ainda vale guardar (cm).
    minSide?: number;
}

export const DEFAULT_REMNANT_MIN_SIDE_CM = 20;

/**
 * Sobras retangulares que saem inteiras seguindo os cortes retos do plano:
 * em cada região, o que fica à direita e abaixo das peças é separado antes
 * dos próximos cortes. Só volta o que tem os dois lados >= minSide; tiras
 * estreitas demais continuam na região e podem somar com sobras internas.
 */
export const findRemnants = (items: Box[], rollWidth: number, totalHeight: number, options: RemnantOptions = {}): Remnant[] => {
    const margin = (options.gap ?? 0) / 2;
    const minSide = options.minSide ?? DEFAULT_REMNANT_MIN_SIDE_CM;
    const remnants: Remnant[] = [];
    const usable = (rect: Remnant) => rect.w >= minSide && rect.h >= minSide;
    const toRemnant = (x: number, y: number, w: number, h: number): Remnant => ({
        x, y, w: Math.floor(w + EPSILON), h: Math.floor(h + EPSILON),
    });

    const trimRemnants = (group: Box[], region: Box): Box => {
        const right = Math.max(...group.map(item => item.x + item.w));
        const bottom = Math.max(...group.map(item => item.y + item.h));
        const rightW = region.x + region.w - right - margin;
        const bottomH = region.y + region.h - bottom - margin;

        // A sobra em "L" sai em dois retângulos; escolhe a divisão que aproveita mais.
        const rightFirst = {
            right: toRemnant(right + margin, region.y, rightW, region.h),
            bottom: toRemnant(region.x, bottom + margin, right - region.x, bottomH),
        };
        const bottomFirst = {
            right: toRemnant(right + margin, region.y, rightW, bottom - region.y),
            bottom: toRemnant(region.x, bottom + margin, region.w, bottomH),
        };
        const keptArea = (option: typeof rightFirst) => [option.right, option.bottom]
            .filter(usable).reduce((sum, rect) => sum + rect.w * rect.h, 0);
        const best = keptArea(bottomFirst) > keptArea(rightFirst) ? bottomFirst : rightFirst;
        const keepRight = usable(best.right);
        const keepBottom = usable(best.bottom);
        if (keepRight) remnants.push(best.right);
        if (keepBottom) remnants.push(best.bottom);

        // Só recorta o que virou retalho; o resto segue para os próximos cortes.
        return {
            x: region.x,
            y: region.y,
            w: keepRight ? right - region.x : region.w,
            h: keepBottom ? bottom - region.y : region.h,
        };
    };

    const cuttable = walkStraightCuts(items, { x: 0, y: 0, w: rollWidth, h: totalHeight }, () => undefined, trimRemnants);

    if (!cuttable) return [];
    return remnants.sort((a, b) => a.y - b.y || a.x - b.x);
};
