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
        expect(screen.getByText('faixas: 8,80 m')).toBeInTheDocument();

        // Sem o plano da outra direção, compara só as faixas.
        const directions = screen.getByRole('group', { name: /Direção da emenda de 2,20 × 3,00 m/ });
        expect(within(directions).getByRole('button', { name: 'Horizontal · faixas 8,80 m' })).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(within(directions).getByRole('button', { name: 'Vertical · faixas 12,00 m' }));
        expect(onDirectionChange).toHaveBeenCalledWith(['7-0', '7-1'], 'vertical');

        fireEvent.click(screen.getByRole('button', { name: 'Faixas iguais' }));
        expect(onSeamStyleChange).toHaveBeenCalledWith('equal');
    });

    it('compara o plano inteiro de cada direção e mostra a diferença em reais', () => {
        const seamPieces = seamPiecesFor({ rollWidth: 152, allowRotation: true }, [[220, 300, '7-0']]);
        render(<CuttingSeamNotice
            seamPieces={seamPieces}
            seamStyle="full"
            rollWidth={152}
            planTotalCm={740}
            alternativeTotals={{ '220x300|horizontal': 760 }}
            pricePerMeter={100}
            onSeamStyleChange={vi.fn()}
            onDirectionChange={vi.fn()}
        />);

        const directions = screen.getByRole('group', { name: /Direção da emenda/ });
        const horizontal = within(directions).getByRole('button', { name: 'Horizontal · plano 7,40 m' });
        const vertical = within(directions).getByRole('button', { name: 'Vertical · plano 7,60 m' });
        expect(horizontal).toHaveTextContent('mais econômica');
        expect(vertical).toHaveTextContent(/\+0,20 m\s*\+R\$\s*20,00/);
        expect(screen.getByText(/sobra ao lado da faixa mais estreita/)).toBeInTheDocument();
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
        expect(screen.getByRole('img', { name: /2 faixas em pé/ })).toBeInTheDocument();
        expect(screen.queryByRole('group', { name: /Direção da emenda/ })).not.toBeInTheDocument();
    });
});
