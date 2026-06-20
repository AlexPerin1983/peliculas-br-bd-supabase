import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { useProposalEditor } from './useProposalEditor';
import * as db from '../../services/db';

vi.mock('../../services/db', () => ({
  getProposalOptions: vi.fn(),
  saveProposalOptions: vi.fn()
}));

const mockedDb = vi.mocked(db);

describe('useProposalEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  const films = [
    { nome: 'Blackout', preco: 100 }
  ];

  function buildHook(selectedClientId: number | null = 1, loadClients = vi.fn().mockResolvedValue(undefined)) {
    return {
      loadClients,
      ...renderHook(() =>
        useProposalEditor({
          selectedClientId,
          films: films as any,
          loadClients
        })
      )
    };
  }

  it('cria opcao padrao quando cliente nao possui opcoes salvas', async () => {
    mockedDb.getProposalOptions.mockResolvedValue([]);

    const { result } = buildHook();

    await act(async () => {});

    expect(result.current.proposalOptions).toHaveLength(1);
    expect(result.current.activeOption?.name).toBe('Opcao 1');
    expect(result.current.activeOption?.measurements).toEqual([]);
    expect(result.current.generalDiscount.pricingMode).toBe('complete');
  });

  it('carrega opcoes salvas e ativa a primeira', async () => {
    mockedDb.getProposalOptions.mockResolvedValue([
      {
        id: 50,
        name: 'Opcao Salva',
        measurements: [{ id: 1, largura: '1', altura: '1', quantidade: 1 }],
        generalDiscount: { value: '5', type: 'percentage', pricingMode: 'labor_only' }
      },
      {
        id: 51,
        name: 'Opcao 2',
        measurements: [],
        generalDiscount: { value: '', type: 'percentage' }
      }
    ]);

    const { result } = buildHook();

    await act(async () => {});

    expect(result.current.proposalOptions).toHaveLength(2);
    expect(result.current.activeOptionId).toBe(50);
    expect(result.current.generalDiscount).toEqual({
      value: '5',
      type: 'percentage',
      operation: 'discount',
      discountType: 'percentage',
      discountValue: '5',
      increaseType: 'fixed',
      increaseValue: '',
      pricingMode: 'labor_only',
      expenses: []
    });
  });

  it('adiciona medida usando a pelicula padrao disponivel', async () => {
    mockedDb.getProposalOptions.mockResolvedValue([]);

    const { result } = buildHook();

    await act(async () => {});

    act(() => {
      result.current.addMeasurement();
    });

    expect(result.current.measurements).toHaveLength(1);
    expect(result.current.measurements[0].pelicula).toBe('Blackout');
  });

  it('duplica, renomeia e exclui opcoes mantendo a ativa coerente', async () => {
    mockedDb.getProposalOptions.mockResolvedValue([
      {
        id: 10,
        name: 'Opcao Base',
        measurements: [{ id: 1, largura: '1', altura: '1', quantidade: 1 }],
        generalDiscount: { value: '', type: 'percentage' }
      }
    ]);

    const { result } = buildHook();

    await act(async () => {});

    act(() => {
      result.current.duplicateActiveOption();
    });

    expect(result.current.proposalOptions).toHaveLength(2);
    const duplicatedId = result.current.activeOptionId!;

    act(() => {
      result.current.renameProposalOption(duplicatedId, 'Opcao Duplicada');
    });

    expect(result.current.activeOption?.name).toBe('Opcao Duplicada');

    act(() => {
      result.current.deleteProposalOption(duplicatedId);
    });

    expect(result.current.proposalOptions).toHaveLength(1);
    expect(result.current.activeOption?.name).toBe('Opcao Base');
  });

  it('duplica aplicando uma pelicula em todos os grupos', async () => {
    mockedDb.getProposalOptions.mockResolvedValue([
      {
        id: 20,
        name: 'Base',
        measurements: [
          { id: 1, largura: '1', altura: '1', quantidade: 1, pelicula: 'Window Blue' },
          { id: 2, largura: '2', altura: '1', quantidade: 1, pelicula: 'Window Blue' }
        ],
        generalDiscount: { value: '', type: 'percentage' }
      }
    ]);

    const { result } = buildHook();

    await act(async () => {});

    act(() => {
      result.current.duplicateActiveOption('Blackout');
    });

    expect(result.current.proposalOptions).toHaveLength(2);
    const duplicated = result.current.activeOption!;
    expect(duplicated.measurements).toHaveLength(2);
    expect(duplicated.measurements.every(m => m.pelicula === 'Blackout')).toBe(true);
    // A opcao de origem permanece intacta.
    const base = result.current.proposalOptions.find(opt => opt.id === 20)!;
    expect(base.measurements.every(m => m.pelicula === 'Window Blue')).toBe(true);
  });

  it('salva automaticamente apos alteracoes pendentes', async () => {
    vi.useFakeTimers();
    mockedDb.getProposalOptions.mockResolvedValue([]);
    mockedDb.saveProposalOptions.mockResolvedValue(undefined as any);

    const { result, loadClients } = buildHook();

    await act(async () => {});

    act(() => {
      result.current.addProposalOption();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });

    expect(mockedDb.saveProposalOptions).toHaveBeenCalledWith(1, expect.any(Array));
    expect(loadClients).toHaveBeenCalledWith(1, false);
    expect(result.current.isDirty).toBe(false);
  });

  it('permite trocar o modo de cobranca da opcao ativa', async () => {
    mockedDb.getProposalOptions.mockResolvedValue([]);

    const { result } = buildHook();

    await act(async () => {});

    act(() => {
      result.current.handleProposalPricingModeChange('labor_only');
    });

    expect(result.current.generalDiscount.pricingMode).toBe('labor_only');
  });

  it('preserva modo de cobranca ao atualizar desconto e salva gastos da proposta', async () => {
    mockedDb.getProposalOptions.mockResolvedValue([
      {
        id: 10,
        name: 'Opcao Base',
        measurements: [],
        generalDiscount: { value: '', type: 'percentage', pricingMode: 'labor_only' }
      }
    ]);

    const { result } = buildHook();

    await act(async () => {});

    act(() => {
      result.current.handleProposalExpensesChange([
        { id: 'traffic', category: 'paid_traffic', amount: '20' }
      ]);
    });

    act(() => {
      result.current.handleGeneralDiscountChange({ value: '5', type: 'percentage' });
    });

    expect(result.current.generalDiscount.pricingMode).toBe('labor_only');
    expect(result.current.generalDiscount.operation).toBe('discount');
    expect(result.current.generalDiscount.expenses).toEqual([
      { id: 'traffic', category: 'paid_traffic', amount: '20' }
    ]);
  });
});
