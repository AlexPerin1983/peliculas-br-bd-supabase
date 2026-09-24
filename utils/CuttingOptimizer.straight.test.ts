import { describe, expect, it } from 'vitest';
import { CuttingOptimizer, CutPreference, Rect } from './CuttingOptimizer';
import { isStraightCuttable } from './straightCuts';

// Medidas do orçamento "Cliente teste" (largura x altura em cm, quantidade).
const CLIENTE_TESTE: [number, number, number][] = [
    [120, 25, 5],
    [58, 25, 7],
    [125, 39, 9],
    [200, 25, 3],
];

const optimize = (pieces: [number, number, number][], cutPreference?: CutPreference, rollWidth = 152) => {
    const optimizer = new CuttingOptimizer({ rollWidth, bladeWidth: 5, allowRotation: true, cutPreference });
    let id = 0;
    pieces.forEach(([w, h, qty]) => {
        for (let i = 0; i < qty; i++) optimizer.addItem(w, h, `m${id++}`);
    });
    return optimizer.optimize();
};

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01;

describe('isStraightCuttable', () => {
    it('aceita faixas atravessadas com colunas', () => {
        expect(isStraightCuttable([
            { x: 0, y: 0, w: 125, h: 39 },
            { x: 0, y: 44, w: 25, h: 200 },
            { x: 30, y: 44, w: 25, h: 120 },
            { x: 30, y: 169, w: 25, h: 58 },
        ])).toBe(true);
    });

    it('recusa peças em degrau (catavento)', () => {
        expect(isStraightCuttable([
            { x: 0, y: 0, w: 60, h: 30 },
            { x: 60, y: 0, w: 30, h: 60 },
            { x: 30, y: 60, w: 60, h: 30 },
            { x: 0, y: 30, w: 30, h: 60 },
        ])).toBe(false);
    });
});

describe('CuttingOptimizer em faixas', () => {
    it('gera plano só com cortes retos para o Cliente teste, sem gastar mais de 3%', () => {
        const result = optimize(CLIENTE_TESTE);
        const { compactHeight, straightHeight } = result.layoutComparison!;

        expect(result.placedItems).toHaveLength(24);
        expect(result.straightCuts).toBe(true);
        expect(isStraightCuttable(result.placedItems)).toBe(true);
        expect(straightHeight).not.toBeNull();
        expect(result.totalHeight).toBeLessThanOrEqual(compactHeight * 1.03 + 0.01);
        result.placedItems.forEach((item, index) => {
            expect(item.x).toBeGreaterThanOrEqual(0);
            expect(item.x + item.w).toBeLessThanOrEqual(152 + 0.01);
            result.placedItems.slice(index + 1).forEach(other => expect(overlaps(item, other)).toBe(false));
        });
    });

    it('mantém o plano mais compacto quando pedido', () => {
        const compact = optimize(CLIENTE_TESTE, 'compact');
        expect(compact.totalHeight).toBe(compact.layoutComparison!.compactHeight);
    });

    it('nunca deixa peças de fora para ter cortes retos', () => {
        const result = optimize([[160, 40, 1], [100, 50, 3], [45, 30, 6], [70, 20, 4]]);
        expect(result.placedItems.length + (result.unplacedItems?.length ?? 0)).toBe(14);
        expect(result.placedItems.length).toBe(optimize([[160, 40, 1], [100, 50, 3], [45, 30, 6], [70, 20, 4]], 'compact').placedItems.length);
    });
});
