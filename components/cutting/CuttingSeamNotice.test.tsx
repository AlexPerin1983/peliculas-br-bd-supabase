import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import CuttingSeamNotice from './CuttingSeamNotice';
import { CuttingOptimizer } from '../../utils/CuttingOptimizer';

const seamPiecesFor = (options: ConstructorParameters<typeof CuttingOptimizer>[0], pieces: [number, number, string][]) => {
    const optimizer = new CuttingOptimizer(options);
    pieces.forEach(([w, h, id]) => optimizer.addItem(w, h, id));
    return optimizer.optimize().seamPieces ?? [];
};

describe('CuttingSeamNotice', () => {
    it('mostra as faixas, onde fica a emenda e troca a direção das peças iguais juntas', () => {
        const onDirectionChange = vi.fn();
        const onSeamStyleChange = vi.fn();
        render(<CuttingSeamNotice
            seamPieces={seamPiecesFor({ rollWidth: 152, allowRotation: true }, [[220, 300, '7-0'], [220, 300, '7-1']])}
            seamStyle="full"
            rollWidth={152}
            onSeamStyleChange={onSeamStyleChange}
            onDirectionChange={onDirectionChange}
        />);

        expect(screen.getByText('2 peças maiores que a bobina')).toBeInTheDocument();
        expect(screen.getByText(/2 faixas deitadas de 2,20 m \(1,52 \+ 1,48\) · emenda a 1,52 m do topo/)).toBeInTheDocument();
        expect(screen.getByText('8,80 m de bobina')).toBeInTheDocument();

        const directions = screen.getByRole('group', { name: /Direção da emenda de 2,20 × 3,00 m/ });
        expect(within(directions).getByRole('button', { name: /Horizontal · 8,80 m/ })).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(within(directions).getByRole('button', { name: /Vertical · 12,00 m/ }));
        expect(onDirectionChange).toHaveBeenCalledWith(['7-0', '7-1'], 'vertical');

        fireEvent.click(screen.getByRole('button', { name: 'Faixas iguais' }));
        expect(onSeamStyleChange).toHaveBeenCalledWith('equal');
    });

    it('com "Resp. Veio" explica que a peça caberia girada', () => {
        render(<CuttingSeamNotice
            seamPieces={seamPiecesFor({ rollWidth: 152, allowRotation: false }, [[220, 120, '3-0']])}
            seamStyle="full"
            rollWidth={152}
            onSeamStyleChange={vi.fn()}
            onDirectionChange={vi.fn()}
        />);

        expect(screen.getByText(/2 faixas em pé de 1,20 m \(1,52 \+ 0,68\) · emenda a 1,52 m da esquerda/)).toBeInTheDocument();
        expect(screen.getByText(/Sem ele, caberia inteira girada/)).toBeInTheDocument();
        expect(screen.queryByRole('group', { name: /Direção da emenda/ })).not.toBeInTheDocument();
    });
});
