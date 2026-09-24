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
