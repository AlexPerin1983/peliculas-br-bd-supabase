import { renderHook } from '@testing-library/react';
import { useProposalTotals } from './useProposalTotals';
import { Film, UIMeasurement } from '../../types';

describe('useProposalTotals', () => {
  it('calcula subtotal, descontos e total final corretamente', () => {
    const films: Film[] = [
      {
        nome: 'Blackout',
        preco: 100,
        maoDeObra: 25,
        precoMetroLinear: 20
      }
    ];

    const measurements: UIMeasurement[] = [
      {
        id: 1,
        largura: '2',
        altura: '1',
        quantidade: 2,
        ambiente: 'Sala',
        tipoAplicacao: 'Interna',
        pelicula: 'Blackout',
        active: true,
        discount: {
          value: '10',
          type: 'percentage'
        }
      },
      {
        id: 2,
        largura: '1',
        altura: '1',
        quantidade: 1,
        ambiente: 'Quarto',
        tipoAplicacao: 'Interna',
        pelicula: 'Blackout',
        active: false
      }
    ];

    const { result } = renderHook(() =>
      useProposalTotals({
        measurements,
        films,
        generalDiscount: {
          value: '20',
          type: 'fixed'
        }
      })
    );

    expect(result.current.totalM2).toBeCloseTo(4);
    expect(result.current.subtotal).toBeCloseTo(400);
    expect(result.current.totalItemDiscount).toBeCloseTo(40);
    expect(result.current.priceAfterItemDiscounts).toBeCloseTo(360);
    expect(result.current.generalDiscountAmount).toBeCloseTo(20);
    expect(result.current.finalTotal).toBeCloseTo(340);
    expect(result.current.totalMaterial).toBeCloseTo(400);
    expect(result.current.totalLabor).toBeCloseTo(100);
    expect(result.current.groupedTotals?.Blackout.totalM2).toBeCloseTo(4);
    expect(result.current.groupedTotals?.Blackout.totalMaterial).toBeCloseTo(400);
    expect(result.current.groupedTotals?.Blackout.totalLabor).toBeCloseTo(100);
  });

  it('nao deixa o total final ficar negativo com desconto fixo alto', () => {
    const films: Film[] = [
      {
        nome: 'Carbono',
        preco: 50
      }
    ];

    const measurements: UIMeasurement[] = [
      {
        id: 1,
        largura: '1',
        altura: '1',
        quantidade: 1,
        ambiente: 'Sala',
        tipoAplicacao: 'Interna',
        pelicula: 'Carbono',
        active: true
      }
    ];

    const { result } = renderHook(() =>
      useProposalTotals({
        measurements,
        films,
        generalDiscount: {
          value: '500',
          type: 'fixed'
        }
      })
    );

    expect(result.current.subtotal).toBeCloseTo(50);
    expect(result.current.finalTotal).toBe(0);
  });
});
