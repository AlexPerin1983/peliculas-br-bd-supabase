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
          type: 'fixed',
          pricingMode: 'complete'
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

  it('usa a area exibida com duas casas para calcular material e mao de obra', () => {
    const films: Film[] = [
      {
        nome: 'Carbono black',
        preco: 130,
        maoDeObra: 100
      }
    ];

    const measurements: UIMeasurement[] = [
      {
        id: 1,
        largura: '22,9113',
        altura: '1',
        quantidade: 1,
        ambiente: 'Sala',
        tipoAplicacao: 'Interna',
        pelicula: 'Carbono black',
        active: true
      }
    ];

    const { result } = renderHook(() =>
      useProposalTotals({
        measurements,
        films,
        generalDiscount: {
          value: '0',
          type: 'percentage',
          pricingMode: 'complete'
        }
      })
    );

    expect(result.current.totalM2).toBe(22.91);
    expect(result.current.totalMaterial).toBeCloseTo(2978.3);
    expect(result.current.totalLabor).toBeCloseTo(2291);
    expect(result.current.groupedTotals?.['Carbono black'].totalMaterial).toBeCloseTo(2978.3);
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
          type: 'fixed',
          pricingMode: 'complete'
        }
      })
    );

    expect(result.current.subtotal).toBeCloseTo(50);
    expect(result.current.finalTotal).toBe(0);
  });

  it('permite acrescimo geral em porcentagem e valor fixo', () => {
    const films: Film[] = [
      {
        nome: 'Carbono',
        preco: 100
      }
    ];

    const measurements: UIMeasurement[] = [
      {
        id: 1,
        largura: '1',
        altura: '1',
        quantidade: 2,
        ambiente: 'Sala',
        tipoAplicacao: 'Interna',
        pelicula: 'Carbono',
        active: true
      }
    ];

    const percentageResult = renderHook(() =>
      useProposalTotals({
        measurements,
        films,
        generalDiscount: {
          value: '10',
          type: 'percentage',
          operation: 'increase',
          pricingMode: 'complete'
        }
      })
    ).result;

    expect(percentageResult.current.generalDiscountAmount).toBeCloseTo(20);
    expect(percentageResult.current.finalTotal).toBeCloseTo(220);

    const fixedResult = renderHook(() =>
      useProposalTotals({
        measurements,
        films,
        generalDiscount: {
          value: '35',
          type: 'fixed',
          operation: 'increase',
          pricingMode: 'complete'
        }
      })
    ).result;

    expect(fixedResult.current.generalDiscountAmount).toBeCloseTo(35);
    expect(fixedResult.current.finalTotal).toBeCloseTo(235);
  });

  it('permite acrescimo embutido e desconto final na mesma proposta', () => {
    const films: Film[] = [
      {
        nome: 'Carbono',
        preco: 100
      }
    ];

    const measurements: UIMeasurement[] = [
      {
        id: 1,
        largura: '1',
        altura: '1',
        quantidade: 2,
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
          value: '10',
          type: 'fixed',
          operation: 'discount',
          increaseValue: '50',
          increaseType: 'fixed',
          discountValue: '10',
          discountType: 'percentage',
          pricingMode: 'complete'
        }
      })
    );

    expect(result.current.priceAfterItemDiscounts).toBeCloseTo(200);
    expect(result.current.generalIncreaseAmount).toBeCloseTo(50);
    expect(result.current.generalFinalDiscountAmount).toBeCloseTo(25);
    expect(result.current.generalDiscountAmount).toBeCloseTo(25);
    expect(result.current.finalTotal).toBeCloseTo(225);
  });

  it('usa apenas mao de obra quando a proposta esta nesse modo', () => {
    const films: Film[] = [
      {
        nome: 'Nano',
        preco: 120,
        maoDeObra: 35,
        precoMetroLinear: 25
      }
    ];

    const measurements: UIMeasurement[] = [
      {
        id: 1,
        largura: '2',
        altura: '1',
        quantidade: 1,
        ambiente: 'Sala',
        tipoAplicacao: 'Interna',
        pelicula: 'Nano',
        active: true
      }
    ];

    const { result } = renderHook(() =>
      useProposalTotals({
        measurements,
        films,
        generalDiscount: {
          value: '0',
          type: 'percentage',
          pricingMode: 'labor_only'
        }
      })
    );

    expect(result.current.pricingMode).toBe('labor_only');
    expect(result.current.subtotal).toBeCloseTo(70);
    expect(result.current.totalMaterial).toBe(0);
    expect(result.current.totalLabor).toBeCloseTo(70);
    expect(result.current.linearMeterCost).toBe(0);
    expect(result.current.groupedTotals?.Nano.unitPriceMaterial).toBe(0);
    expect(result.current.groupedTotals?.Nano.unitPriceLabor).toBe(35);
  });

  it('soma gastos internos e calcula resultado estimado da proposta', () => {
    const films: Film[] = [
      {
        nome: 'Blackout',
        preco: 100,
        precoMetroLinear: 20
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
        pelicula: 'Blackout',
        active: true
      }
    ];

    const { result } = renderHook(() =>
      useProposalTotals({
        measurements,
        films,
        generalDiscount: {
          value: '0',
          type: 'percentage',
          pricingMode: 'complete',
          expenses: [
            { id: 'traffic', category: 'paid_traffic', amount: '15,50' },
            { id: 'transport', category: 'transport', amount: '10' }
          ]
        }
      })
    );

    expect(result.current.operationalExpenses).toBeCloseTo(25.5);
    expect(result.current.estimatedTotalCost).toBeGreaterThan(25.5);
    expect(result.current.estimatedProfit).toBeCloseTo(result.current.finalTotal - result.current.estimatedTotalCost);
    expect(result.current.expensesByCategory?.map(item => item.category)).toEqual(['paid_traffic', 'transport']);
  });

  it('cobra por metro linear quando a pelicula esta nesse modo', () => {
    const films: Film[] = [
      {
        nome: 'Adesivo',
        preco: 100,
        precoVendaMetroLinear: 40,
        precoMetroLinear: 20
      }
    ];

    const measurements: UIMeasurement[] = [
      {
        id: 1,
        largura: '1',
        altura: '1',
        quantidade: 1,
        ambiente: 'Parede',
        tipoAplicacao: 'Interna',
        pelicula: 'Adesivo',
        active: true,
        discount: { value: '10', type: 'percentage' }
      }
    ];

    const { result } = renderHook(() =>
      useProposalTotals({
        measurements,
        films,
        generalDiscount: {
          value: '0',
          type: 'percentage',
          pricingMode: 'complete',
          filmPricingModes: { Adesivo: 'linear' }
        }
      })
    );

    const linearMeters = result.current.totalLinearMeters;
    expect(linearMeters).toBeGreaterThan(0);

    // Venda = preco de venda por metro linear x metros lineares (ignora preco/m2).
    expect(result.current.subtotal).toBeCloseTo(linearMeters * 40);
    // Desconto por item nao se aplica no modo linear.
    expect(result.current.totalItemDiscount).toBe(0);
    expect(result.current.priceAfterItemDiscounts).toBeCloseTo(linearMeters * 40);
    expect(result.current.finalTotal).toBeCloseTo(linearMeters * 40);
    // Area continua sendo contabilizada para exibicao.
    expect(result.current.totalM2).toBeCloseTo(1);
    // Custo (margem) continua usando o custo por metro linear.
    expect(result.current.linearMeterCost).toBeCloseTo(linearMeters * 20);
    expect(result.current.groupedTotals?.Adesivo.filmPricingMode).toBe('linear');
    expect(result.current.groupedTotals?.Adesivo.unitSalePriceLinearMeter).toBe(40);
    expect(result.current.groupedTotals?.Adesivo.linearSaleSubtotal).toBeCloseTo(linearMeters * 40);
  });

  it('mistura cobranca por m2 e por metro linear na mesma proposta', () => {
    const films: Film[] = [
      { nome: 'Janela', preco: 100 },
      { nome: 'Parede', preco: 80, precoVendaMetroLinear: 50 }
    ];

    const measurements: UIMeasurement[] = [
      {
        id: 1,
        largura: '2',
        altura: '1',
        quantidade: 1,
        ambiente: 'Janela',
        tipoAplicacao: 'Interna',
        pelicula: 'Janela',
        active: true
      },
      {
        id: 2,
        largura: '1',
        altura: '1',
        quantidade: 1,
        ambiente: 'Parede',
        tipoAplicacao: 'Interna',
        pelicula: 'Parede',
        active: true
      }
    ];

    const { result } = renderHook(() =>
      useProposalTotals({
        measurements,
        films,
        generalDiscount: {
          value: '0',
          type: 'percentage',
          pricingMode: 'complete',
          filmPricingModes: { Parede: 'linear' }
        }
      })
    );

    const paredeLinearMeters = result.current.groupedTotals?.Parede.totalLinearMeters || 0;
    expect(paredeLinearMeters).toBeGreaterThan(0);

    // Janela por m2 (2 m2 x 100) + Parede por metro linear.
    expect(result.current.subtotal).toBeCloseTo(200 + paredeLinearMeters * 50);
    expect(result.current.groupedTotals?.Janela.filmPricingMode).toBe('area');
    expect(result.current.groupedTotals?.Parede.filmPricingMode).toBe('linear');
  });

  it('ignora venda por metro linear no modo apenas mao de obra', () => {
    const films: Film[] = [
      {
        nome: 'Adesivo',
        preco: 100,
        maoDeObra: 30,
        precoVendaMetroLinear: 40
      }
    ];

    const measurements: UIMeasurement[] = [
      {
        id: 1,
        largura: '2',
        altura: '1',
        quantidade: 1,
        ambiente: 'Parede',
        tipoAplicacao: 'Interna',
        pelicula: 'Adesivo',
        active: true
      }
    ];

    const { result } = renderHook(() =>
      useProposalTotals({
        measurements,
        films,
        generalDiscount: {
          value: '0',
          type: 'percentage',
          pricingMode: 'labor_only',
          filmPricingModes: { Adesivo: 'linear' }
        }
      })
    );

    // No modo mao de obra, cobra por m2 da mao de obra (2 x 30), ignora o metro linear.
    expect(result.current.subtotal).toBeCloseTo(60);
    expect(result.current.groupedTotals?.Adesivo.filmPricingMode).toBe('area');
  });

  it('recalcula a proposta com preços personalizados sem alterar o catálogo', () => {
    const films: Film[] = [{
      nome: 'Jateada',
      preco: 100,
      maoDeObra: 35,
      precoMetroLinear: 25,
      precoVendaMetroLinear: 80
    }];
    const measurements: UIMeasurement[] = [{
      id: 1,
      largura: '2',
      altura: '1',
      quantidade: 1,
      ambiente: 'Sala',
      tipoAplicacao: 'Interna',
      pelicula: 'Jateada',
      active: true
    }];

    const { result } = renderHook(() => useProposalTotals({
      measurements,
      films,
      generalDiscount: {
        value: '0',
        type: 'percentage',
        pricingMode: 'complete',
        filmPriceOverrides: {
          Jateada: { preco: '85', maoDeObra: '30', precoMetroLinear: '20' }
        }
      }
    }));

    expect(result.current.subtotal).toBeCloseTo(170);
    expect(result.current.finalTotal).toBeCloseTo(170);
    expect(result.current.totalMaterial).toBeCloseTo(170);
    expect(result.current.totalLabor).toBeCloseTo(60);
    expect(result.current.groupedTotals?.Jateada.unitPriceMaterial).toBe(85);
    expect(result.current.groupedTotals?.Jateada.catalogUnitPriceMaterial).toBe(100);
    expect(films[0].preco).toBe(100);
  });

  it('usa a venda e o custo personalizados no modo metro linear', () => {
    const films: Film[] = [{
      nome: 'Jateada',
      preco: 100,
      precoMetroLinear: 25,
      precoVendaMetroLinear: 80
    }];
    const measurements: UIMeasurement[] = [{
      id: 1,
      largura: '1',
      altura: '1',
      quantidade: 1,
      ambiente: 'Sala',
      tipoAplicacao: 'Interna',
      pelicula: 'Jateada',
      active: true
    }];

    const { result } = renderHook(() => useProposalTotals({
      measurements,
      films,
      generalDiscount: {
        value: '0',
        type: 'percentage',
        pricingMode: 'complete',
        filmPricingModes: { Jateada: 'linear' },
        filmPriceOverrides: {
          Jateada: { precoVendaMetroLinear: '60', precoMetroLinear: '20' }
        }
      }
    }));

    expect(result.current.finalTotal).toBeCloseTo(result.current.totalLinearMeters * 60);
    expect(result.current.linearMeterCost).toBeCloseTo(result.current.totalLinearMeters * 20);
    expect(result.current.groupedTotals?.Jateada.unitSalePriceLinearMeter).toBe(60);
  });
});

describe('useProposalTotals cutting widths', () => {
  it('usa a largura escolhida no plano de corte para calcular metro linear e custo', () => {
    const films: Film[] = [
      {
        nome: 'Color Stable',
        preco: 220,
        precoMetroLinear: 110,
      },
    ];
    const measurements: UIMeasurement[] = [
      {
        id: 1,
        largura: '0,70',
        altura: '1,00',
        quantidade: 2,
        ambiente: 'Janela',
        tipoAplicacao: 'Interna',
        pelicula: 'Color Stable',
        active: true,
      },
    ];

    const at152 = renderHook(() => useProposalTotals({
      measurements,
      films,
      generalDiscount: {
        value: '0',
        type: 'percentage',
        filmCuttingSettings: {
          'Color Stable': { rollWidthCm: 152, bladeWidthMm: 0, respectGrain: false },
        },
      },
    }));
    const at122 = renderHook(() => useProposalTotals({
      measurements,
      films,
      generalDiscount: {
        value: '0',
        type: 'percentage',
        filmCuttingSettings: {
          'Color Stable': { rollWidthCm: 122, bladeWidthMm: 0, respectGrain: false },
        },
      },
    }));

    expect(at152.result.current.totalLinearMeters).toBeCloseTo(1);
    expect(at122.result.current.totalLinearMeters).toBeCloseTo(1.4);
    expect(at152.result.current.linearMeterCost).toBeCloseTo(110);
    expect(at122.result.current.linearMeterCost).toBeCloseTo(154);
    expect(at122.result.current.groupedTotals?.['Color Stable'].totalLinearMeters).toBeCloseTo(1.4);
  });
});
