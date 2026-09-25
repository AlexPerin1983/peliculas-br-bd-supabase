import { describe, expect, it } from 'vitest';
import { CuttingOptimizer } from './CuttingOptimizer';
import { describeStripSpot, estimateSeamAlternatives, groupSeamPieces } from './seamGroups';
import type { SeamDirection } from './seamStrips';

const plan = (directions: Record<string, SeamDirection> = {}) => {
    const optimizer = new CuttingOptimizer({ rollWidth: 152, allowRotation: true, seamDirections: directions });
    optimizer.addItem(220, 300, 'a');
    optimizer.addItem(80, 140, 'b');
    optimizer.addItem(80, 140, 'c');
    optimizer.addItem(100, 60, 'd');
    return optimizer.optimize();
};

describe('seamGroups', () => {
    it('agrupa peças iguais com a mesma emenda', () => {
        const optimizer = new CuttingOptimizer({ rollWidth: 152, allowRotation: true });
        optimizer.addItem(220, 300, 'x-0');
        optimizer.addItem(220, 300, 'x-1');
        optimizer.addItem(400, 200, 'y-0');
        const groups = groupSeamPieces(optimizer.optimize().seamPieces!);
        expect(groups.map(group => [group.key, group.ids, group.count])).toEqual([
            ['220x300|horizontal', ['x-0', 'x-1'], 2],
            ['400x200|vertical', ['y-0'], 1],
        ]);
    });

    it('calcula o plano inteiro da outra direção (a sobra da faixa estreita recebe outras peças)', () => {
        const current = plan();
        const totals = estimateSeamAlternatives(
            groupSeamPieces(current.seamPieces!),
            directions => plan(directions).totalHeight,
        );
        // As faixas em pé somam 1,60 m a mais, mas as outras peças cabem ao lado da faixa
        // de 0,68 m: neste caso o plano inteiro dá o mesmo gasto.
        expect(current.seamPieces![0].chosen.direction).toBe('horizontal');
        expect(current.seamPieces![0].alternative!.linearCm - current.seamPieces![0].chosen.linearCm).toBe(160);
        expect(totals['220x300|horizontal']).toBe(current.totalHeight);
    });

    it('diz onde a faixa vai no vidro', () => {
        expect(describeStripSpot({ direction: 'horizontal', index: 0, count: 2 })).toBe('em cima');
        expect(describeStripSpot({ direction: 'horizontal', index: 1, count: 2 })).toBe('embaixo');
        expect(describeStripSpot({ direction: 'vertical', index: 0, count: 3 })).toBe('à esquerda');
        expect(describeStripSpot({ direction: 'vertical', index: 1, count: 3 })).toBe('no meio');
        expect(describeStripSpot({ direction: 'vertical', index: 2, count: 3 })).toBe('à direita');
    });
});
