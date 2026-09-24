import { describe, expect, it } from 'vitest';
import { CuttingOptimizer, CutPreference, Rect } from './CuttingOptimizer';
import { buildCutLines, formatPieceRanges, getCutBands, isStraightCuttable } from './straightCuts';

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

describe('buildCutLines', () => {
    it('coloca os cortes no espaço entre as peças, em cm inteiro, e numera os principais de cima para baixo', () => {
        // Faixa 1: peça larga. Faixa 2: duas colunas, a segunda com duas peças empilhadas.
        const lines = buildCutLines([
            { x: 0, y: 0, w: 125, h: 39 },
            { x: 0, y: 44, w: 25, h: 120 },
            { x: 30, y: 44, w: 25, h: 58 },
            { x: 30, y: 107, w: 25, h: 57 },
        ], 152, 164)!;

        const main = lines.filter(line => line.level === 1);
        expect(main).toEqual([
            { direction: 'across', position: 42, from: 0, to: 152, level: 1, order: 1 },
            { direction: 'across', position: 164, from: 0, to: 152, level: 1, order: 2, isEnd: true },
        ]);
        // Dentro da faixa 2: separa as colunas ao comprido e depois a coluna empilhada.
        expect(lines).toContainEqual({ direction: 'along', position: 28, from: 42, to: 164, level: 2 });
        expect(lines).toContainEqual({ direction: 'across', position: 105, from: 28, to: 152, level: 3 });
    });

    it('retorna null quando o plano tem peças em degrau', () => {
        expect(buildCutLines([
            { x: 0, y: 0, w: 60, h: 30 },
            { x: 60, y: 0, w: 30, h: 60 },
            { x: 30, y: 60, w: 60, h: 30 },
            { x: 0, y: 30, w: 30, h: 60 },
        ], 90, 90)).toBeNull();
    });

    it('gera linhas para o plano do Cliente teste', () => {
        const result = optimize(CLIENTE_TESTE);
        const lines = buildCutLines(result.placedItems, 152, result.totalHeight)!;
        expect(lines).not.toBeNull();
        // Nenhuma linha passa por dentro de uma peça.
        lines.forEach(line => result.placedItems.forEach(item => {
            const [start, size, crossStart, crossSize] = line.direction === 'across'
                ? [item.y, item.h, item.x, item.w] : [item.x, item.w, item.y, item.h];
            const crossesPiece = line.position > start + 0.01 && line.position < start + size - 0.01
                && line.from < crossStart + crossSize - 0.01 && line.to > crossStart + 0.01;
            expect(crossesPiece).toBe(false);
        }));
    });
});

describe('getCutBands', () => {
    it('mede cada faixa de corte a corte e lista as peças dela', () => {
        const items = [
            { x: 0, y: 0, w: 125, h: 39 },
            { x: 0, y: 44, w: 25, h: 120 },
            { x: 30, y: 44, w: 25, h: 58 },
            { x: 30, y: 107, w: 25, h: 57 },
        ];
        const bands = getCutBands(buildCutLines(items, 152, 164)!, items);
        expect(bands).toEqual([
            { number: 1, start: 0, end: 42, height: 42, pieceNumbers: [1] },
            { number: 2, start: 42, end: 164, height: 122, pieceNumbers: [2, 3, 4] },
        ]);
    });

    it('as faixas somam o comprimento total do plano do Cliente teste', () => {
        const result = optimize(CLIENTE_TESTE);
        const bands = getCutBands(buildCutLines(result.placedItems, 152, result.totalHeight)!, result.placedItems);
        expect(bands.reduce((sum, band) => sum + band.height, 0)).toBeCloseTo(result.totalHeight, 5);
        expect(bands.flatMap(band => band.pieceNumbers).sort((a, b) => a - b)).toEqual(result.placedItems.map((_, index) => index + 1));
    });

    it('resume sequências de peças', () => {
        expect(formatPieceRanges([1, 2, 3, 5, 7, 8])).toBe('1–3, 5, 7–8');
        expect(formatPieceRanges([24])).toBe('24');
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
