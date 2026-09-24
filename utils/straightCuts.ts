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

/**
 * Linhas de corte de um plano feito só com cortes retos, no meio do espaço
 * entre as peças. Retorna null se o plano não pode ser cortado assim.
 */
export const buildCutLines = (items: Box[], rollWidth: number, totalHeight: number): CutLine[] | null => {
    const lines: CutLine[] = [];

    const walk = (group: Box[], region: Box, level: number): boolean => {
        if (group.length <= 1) return true;
        const byY = splitByAxis(group, 'y');
        const groups = byY ?? splitByAxis(group, 'x');
        if (!groups) return false;

        const axis = byY ? 'y' : 'x';
        const size = axis === 'y' ? 'h' : 'w';
        const regionStart = region[axis];
        const regionEnd = region[axis] + region[size];
        const cuts = groups.slice(0, -1).map((current, index) => {
            const end = Math.max(...current.map(item => item[axis] + item[size]));
            const nextStart = Math.min(...groups[index + 1].map(item => item[axis]));
            return (end + nextStart) / 2;
        });

        cuts.forEach(position => lines.push(axis === 'y'
            ? { direction: 'across', position, from: region.x, to: region.x + region.w, level }
            : { direction: 'along', position, from: region.y, to: region.y + region.h, level }));

        const bounds = [regionStart, ...cuts, regionEnd];
        return groups.every((subgroup, index) => walk(subgroup, axis === 'y'
            ? { x: region.x, w: region.w, y: bounds[index], h: bounds[index + 1] - bounds[index] }
            : { y: region.y, h: region.h, x: bounds[index], w: bounds[index + 1] - bounds[index] }, level + 1));
    };

    if (!items.length || !walk(items, { x: 0, y: 0, w: rollWidth, h: totalHeight }, 1)) return null;

    lines.push({ direction: 'across', position: totalHeight, from: 0, to: rollWidth, level: 1, isEnd: true });
    lines
        .filter(line => line.level === 1 && line.direction === 'across')
        .sort((a, b) => a.position - b.position)
        .forEach((line, index) => { line.order = index + 1; });

    return lines;
};
