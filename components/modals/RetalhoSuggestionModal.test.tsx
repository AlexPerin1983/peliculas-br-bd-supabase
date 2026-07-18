import { fireEvent, render, screen } from '@testing-library/react';
import RetalhoSuggestionModal from './RetalhoSuggestionModal';

const measurement = {
    id: 10,
    largura: '1',
    altura: '1',
    quantidade: 3,
    pelicula: 'Jateada',
    ambiente: 'Sala',
    active: true,
};

const retalhos = [
    {
        id: 68,
        filmId: 'Jateada',
        codigoQr: 'PBR-68',
        larguraCm: 100,
        comprimentoCm: 100,
        status: 'disponivel' as const,
        localizacao: 'Carro',
    },
    {
        id: 63,
        filmId: 'Jateada',
        codigoQr: 'PBR-63',
        larguraCm: 105,
        comprimentoCm: 210,
        status: 'disponivel' as const,
    },
];

const renderModal = (onConfirm = vi.fn()) => {
    render(
        <RetalhoSuggestionModal
            isOpen
            measurement={measurement as never}
            retalhos={retalhos}
            onClose={vi.fn()}
            onConfirm={onConfirm}
        />
    );
    return onConfirm;
};

describe('RetalhoSuggestionModal', () => {
    it('mostra primeiro apenas a recomendação e informa o impacto na quantidade', () => {
        renderModal();

        expect(screen.getByText('Melhor opção para 1 das 3 peças')).toBeInTheDocument();
        expect(screen.getByText('Retalho #68')).toBeInTheDocument();
        expect(screen.getByText('Recomendado')).toBeInTheDocument();
        expect(screen.getByText(/atende somente 1 peça/i)).toBeInTheDocument();
        expect(screen.queryByText('Retalho #63')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Ver outros 1 retalho' })).toBeInTheDocument();
    });

    it('revela as alternativas apenas quando solicitado', () => {
        renderModal();

        fireEvent.click(screen.getByRole('button', { name: 'Ver outros 1 retalho' }));

        expect(screen.getByText('Retalho #63')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Ocultar outras opções' })).toBeInTheDocument();
    });

    it('pede confirmação antes de consumir e explica a sobra e as peças pendentes', () => {
        const onConfirm = renderModal();

        fireEvent.click(screen.getByRole('button', { name: 'Usar retalho #68 em 1 peça' }));

        expect(onConfirm).not.toHaveBeenCalled();
        expect(screen.getByText('Usar retalho #68?')).toBeInTheDocument();
        expect(screen.getByText(/2 peças continuarão pendentes/i)).toBeInTheDocument();
        expect(screen.getByText('Nenhuma nova sobra aproveitável será criada.')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Confirmar uso' }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onConfirm.mock.calls[0][0]).toEqual(retalhos[0]);
        expect(onConfirm.mock.calls[0][1]).toMatchObject({ orientation: 'original', appliedWidthCm: 100, appliedLengthCm: 100 });
    });
});
