import { render, screen } from '@testing-library/react';
import EstoqueStatsBar from './EstoqueStatsBar';

describe('EstoqueStatsBar', () => {
    it('exibe metragem disponivel e consumo com duas casas decimais', () => {
        render(
            <EstoqueStatsBar
                stats={{
                    totalBobinasAtivas: 1,
                    totalMetrosDisponiveis: 14.05,
                    totalRetalhoDisponivel: 0,
                    totalAreaRetalhos: 0,
                    consumoUltimos30Dias: 5.95,
                }}
            />
        );

        expect(screen.getAllByText('14,05m')).toHaveLength(2);
        expect(screen.getAllByText('5,95m')).toHaveLength(2);
    });
});
