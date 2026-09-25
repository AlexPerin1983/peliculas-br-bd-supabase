import { describe, expect, it } from 'vitest';
import { countPlacedPieces, CuttingOptimizer } from './CuttingOptimizer';
import { needsSeam, planSeam, splitSeamLength } from './seamStrips';

describe('splitSeamLength', () => {
    it('faixa inteira + complemento por padrão', () => {
        expect(splitSeamLength(220, 152)).toEqual([152, 68]);
        expect(splitSeamLength(400, 152)).toEqual([152, 152, 96]);
        expect(splitSeamLength(304, 152)).toEqual([152, 152]);
    });

    it('faixas iguais como opção', () => {
        expect(splitSeamLength(220, 152, 'equal')).toEqual([110, 110]);
        expect(splitSeamLength(400, 152, 'equal')).toEqual([133.33, 133.33, 133.34]);
    });
});

describe('planSeam', () => {
    it('não divide o que cabe inteiro ou girado', () => {
        expect(planSeam(150, 300, 152, { allowRotation: true })).toBeNull();
        expect(planSeam(220, 120, 152, { allowRotation: true })).toBeNull();
        expect(needsSeam(220, 120, 152, true)).toBe(false);
    });

    it('escolhe a direção que gasta menos bobina (2,20 × 3,00 → emenda horizontal, 4,40 m)', () => {
        const plan = planSeam(220, 300, 152, { allowRotation: true })!;
        expect(plan.chosen).toEqual({ direction: 'horizontal', strips: [152, 148], stripLength: 220, linearCm: 440 });
        expect(plan.alternative).toEqual({ direction: 'vertical', strips: [152, 68], stripLength: 300, linearCm: 600 });
    });

    it('respeita a direção escolhida para a peça', () => {
        expect(planSeam(220, 300, 152, { allowRotation: true, direction: 'vertical' })!.chosen.linearCm).toBe(600);
    });

    it('com "respeitar veio" só usa faixas em pé, mesmo quando girada caberia', () => {
        const plan = planSeam(220, 120, 152, { allowRotation: false })!;
        expect(plan.chosen).toEqual({ direction: 'vertical', strips: [152, 68], stripLength: 120, linearCm: 240 });
        expect(plan.alternative).toBeNull();
    });
});

describe('CuttingOptimizer com emenda', () => {
    it('coloca as faixas no plano e conta a bobina delas (antes a peça ficava de fora)', () => {
        const optimizer = new CuttingOptimizer({ rollWidth: 152, allowRotation: true });
        optimizer.addItem(220, 300, '7-0', '2.20x3.00');
        const result = optimizer.optimize();

        expect(result.unplacedItems).toEqual([]);
        expect(result.placedItems).toHaveLength(2);
        expect(result.totalHeight).toBeCloseTo(440);
        expect(result.placedItems.map(item => item.id).sort()).toEqual(['7-0-f1', '7-0-f2']);
        expect(result.placedItems.every(item => item.w <= 152)).toBe(true);
        expect(result.placedItems.find(item => item.id === '7-0-f2')!.seam).toMatchObject({
            pieceId: '7-0', index: 1, count: 2, direction: 'horizontal', pieceW: 220, pieceH: 300, offset: 152,
        });
        expect(result.seamPieces).toHaveLength(1);
        expect(countPlacedPieces(result.placedItems)).toBe(1);
    });

    it('aproveita a sobra da faixa estreita para outras peças', () => {
        const optimizer = new CuttingOptimizer({
            rollWidth: 152,
            allowRotation: true,
            seamDirections: { a: 'vertical' },
        });
        optimizer.addItem(220, 300, 'a');
        optimizer.addItem(80, 140, 'b');
        const result = optimizer.optimize();

        // Faixas em pé de 3,00 m (152 + 68); a peça de 0,80 × 1,40 cabe ao lado da faixa de 0,68.
        expect(result.unplacedItems).toEqual([]);
        expect(result.totalHeight).toBeCloseTo(600);
    });

    it('sem id (cálculo dos totais) também divide e conta a bobina', () => {
        const optimizer = new CuttingOptimizer({ rollWidth: 152, allowRotation: false });
        optimizer.addItem(220, 300);
        expect(optimizer.optimize().totalHeight).toBeCloseTo(600);
    });
});
