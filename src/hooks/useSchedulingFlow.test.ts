import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { useSchedulingFlow } from './useSchedulingFlow';
import * as db from '../../services/db';
import * as estoqueDb from '../../services/estoqueDb';
import { Agendamento, SavedPDF } from '../../types';

vi.mock('../../services/db', () => ({
  saveAgendamento: vi.fn(),
  getAllPDFs: vi.fn(),
  updatePDF: vi.fn(),
  deleteAgendamento: vi.fn()
}));

vi.mock('../../services/estoqueDb', () => ({
  completeAgendamentoWithStock: vi.fn()
}));

const mockedDb = vi.mocked(db);
const mockedEstoqueDb = vi.mocked(estoqueDb);

describe('useSchedulingFlow', () => {
  const savedPdf: SavedPDF = {
    id: 10,
    clienteId: 1,
    date: new Date().toISOString(),
    totalPreco: 100,
    totalM2: 2,
    nomeArquivo: 'orcamento.pdf'
  };

  const agendamento: Agendamento = {
    id: 50,
    pdfId: 10,
    clienteId: 1,
    clienteNome: 'Cliente',
    start: '2026-03-23T09:00:00.000Z',
    end: '2026-03-23T10:00:00.000Z',
    notes: 'Instalacao'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedDb.saveAgendamento.mockImplementation(async (item) => item as Agendamento);
  });

  function buildHook(overrides: Partial<Parameters<typeof useSchedulingFlow>[0]> = {}) {
    return renderHook(() =>
      useSchedulingFlow({
        allSavedPdfs: [savedPdf],
        agendamentoToDelete: null,
        setAgendamentos: vi.fn(),
        setAllSavedPdfs: vi.fn(),
        setSchedulingInfo: vi.fn(),
        setAgendamentoToDelete: vi.fn(),
        setPdfGenerationStatus: vi.fn(),
        setActiveTab: vi.fn(),
        loadAgendamentos: vi.fn().mockResolvedValue(undefined),
        loadAllPdfs: vi.fn().mockResolvedValue(undefined),
        handleShowInfo: vi.fn(),
        ...overrides
      })
    );
  }

  it('salva agendamento e vincula pdf quando necessario', async () => {
    const loadAgendamentos = vi.fn().mockResolvedValue(undefined);
    const loadAllPdfs = vi.fn().mockResolvedValue(undefined);
    const setSchedulingInfo = vi.fn();

    mockedDb.saveAgendamento.mockResolvedValue({
      ...agendamento,
      id: 55
    });
    mockedDb.getAllPDFs.mockResolvedValue([savedPdf]);
    mockedDb.updatePDF.mockResolvedValue(undefined);

    const { result } = buildHook({
      loadAgendamentos,
      loadAllPdfs,
      setSchedulingInfo
    });

    await act(async () => {
      await result.current.handleSaveAgendamento({
        pdfId: 10,
        clienteId: 1,
        clienteNome: 'Cliente',
        start: agendamento.start,
        end: agendamento.end,
        notes: 'Instalacao'
      });
    });

    expect(mockedDb.saveAgendamento).toHaveBeenCalled();
    expect(mockedDb.updatePDF).toHaveBeenCalledWith({
      ...savedPdf,
      agendamentoId: 55
    });
    expect(loadAgendamentos).toHaveBeenCalled();
    expect(loadAllPdfs).toHaveBeenCalled();
    expect(setSchedulingInfo).toHaveBeenCalledWith(null);
  });

  it('exclui agendamento e remove vinculo do pdf', async () => {
    const setAgendamentos = vi.fn();
    const setAllSavedPdfs = vi.fn();
    const setAgendamentoToDelete = vi.fn();

    mockedDb.getAllPDFs.mockResolvedValue([
      { ...savedPdf, agendamentoId: 50 }
    ]);
    mockedDb.deleteAgendamento.mockResolvedValue(undefined);
    mockedDb.updatePDF.mockResolvedValue(undefined);

    const { result } = buildHook({
      agendamentoToDelete: agendamento,
      setAgendamentos,
      setAllSavedPdfs,
      setAgendamentoToDelete
    });

    await act(async () => {
      await result.current.handleConfirmDeleteAgendamento();
    });

    expect(mockedDb.deleteAgendamento).toHaveBeenCalledWith(50);
    expect(mockedDb.updatePDF).toHaveBeenCalledWith(savedPdf);
    expect(setAllSavedPdfs).toHaveBeenCalled();
    expect(setAgendamentos).toHaveBeenCalled();
    expect(setAgendamentoToDelete).toHaveBeenCalledWith(null);
  });

  it('leva para historico ao sair do fluxo de pdf', () => {
    const setPdfGenerationStatus = vi.fn();
    const setActiveTab = vi.fn();

    const { result } = buildHook({
      setPdfGenerationStatus,
      setActiveTab
    });

    act(() => {
      result.current.handleGoToHistoryFromPdf();
    });

    expect(setPdfGenerationStatus).toHaveBeenCalledWith('idle');
    expect(setActiveTab).toHaveBeenCalledWith('history');
  });

  it('salva a descrição confirmada do recibo sem alterar valor ou status', async () => {
    const setAgendamentos = vi.fn();
    mockedDb.saveAgendamento.mockResolvedValue({
      ...agendamento,
      serviceStatus: 'completed',
      valorFinal: 380,
      receiptDescription: 'Aplicação de película Carbono Prime na sala'
    });
    const completedAppointment = {
      ...agendamento,
      serviceStatus: 'completed' as const,
      valorFinal: 380
    };
    const { result } = buildHook({ setAgendamentos });

    await act(async () => {
      await result.current.handleSaveReceiptDescription(
        completedAppointment,
        '  Aplicação de película Carbono Prime na sala  '
      );
    });

    expect(mockedDb.saveAgendamento).toHaveBeenCalledWith({
      ...completedAppointment,
      receiptDescription: 'Aplicação de película Carbono Prime na sala'
    });
    expect(setAgendamentos).toHaveBeenCalledTimes(1);
  });

  it('desfaz a descrição otimista quando a persistência do recibo falha', async () => {
    const setAgendamentos = vi.fn();
    mockedDb.saveAgendamento.mockRejectedValue(new Error('falha ao persistir'));
    const { result } = buildHook({ setAgendamentos });

    await expect(act(async () => {
      await result.current.handleSaveReceiptDescription(agendamento, 'Serviço confirmado');
    })).rejects.toThrow('falha ao persistir');

    expect(setAgendamentos).toHaveBeenCalledTimes(2);
  });

  it('conclui e baixa todas as linhas de estoque em uma única operação', async () => {
    const setAgendamentos = vi.fn();
    mockedEstoqueDb.completeAgendamentoWithStock.mockResolvedValue({
      agendamentoId: 50,
      stockStatus: 'confirmed',
      stockConsumedAt: '2026-08-07T15:30:00.000Z',
      stockSourcePdfIds: [10],
      alreadyConfirmed: false,
      lines: []
    });
    const lines = [{
      bobinaId: 8,
      metrosConsumidos: 2.4,
      sourceKey: 'agenda:50:film:carbono%20prime',
      filmId: 'Carbono Prime',
      pdfId: 10
    }];
    const { result } = buildHook({ setAgendamentos });

    let completed = false;
    await act(async () => {
      completed = await result.current.handleCompleteAgendamentoWithValue(
        agendamento,
        100,
        { lines, stockStatus: 'confirmed' }
      );
    });

    expect(completed).toBe(true);
    expect(mockedEstoqueDb.completeAgendamentoWithStock).toHaveBeenCalledWith(50, null, lines);
    expect(mockedDb.saveAgendamento).toHaveBeenCalledWith(expect.objectContaining({
      id: 50,
      serviceStatus: 'completed',
      stockStatus: 'confirmed',
      stockConsumedAt: '2026-08-07T15:30:00.000Z',
      stockSourcePdfIds: [10]
    }));
    expect(setAgendamentos).toHaveBeenCalledTimes(2);
  });

  it('mantém a conclusão pendente quando o usuário decide baixar depois', async () => {
    const { result } = buildHook();

    let completed = false;
    await act(async () => {
      completed = await result.current.handleCompleteAgendamentoWithValue(
        agendamento,
        100,
        { stockStatus: 'pending' }
      );
    });

    expect(completed).toBe(true);
    expect(mockedDb.saveAgendamento).toHaveBeenCalledWith(expect.objectContaining({
      id: 50,
      serviceStatus: 'completed',
      stockStatus: 'pending'
    }));
    expect(mockedEstoqueDb.completeAgendamentoWithStock).not.toHaveBeenCalled();
  });

  it('desfaz o estado otimista sem salvar parcialmente quando a baixa falha', async () => {
    const setAgendamentos = vi.fn();
    const handleShowInfo = vi.fn();
    mockedEstoqueDb.completeAgendamentoWithStock.mockRejectedValue(new Error('Saldo insuficiente'));
    const { result } = buildHook({ setAgendamentos, handleShowInfo });

    let completed = true;
    await act(async () => {
      completed = await result.current.handleCompleteAgendamentoWithValue(
        agendamento,
        100,
        {
          stockStatus: 'confirmed',
          lines: [{
            bobinaId: 8,
            metrosConsumidos: 20,
            sourceKey: 'agenda:50:film:carbono%20prime'
          }]
        }
      );
    });

    expect(completed).toBe(false);
    expect(mockedDb.saveAgendamento).not.toHaveBeenCalled();
    expect(setAgendamentos).toHaveBeenCalledTimes(2);
    expect(handleShowInfo).toHaveBeenCalledWith(expect.stringMatching(/nenhum material foi descontado.*saldo insuficiente/i));
  });

  it('leva a descrição do serviço para uma continuação sem religar o orçamento', () => {
    const setSchedulingInfo = vi.fn();
    const pdfWithService = {
      ...savedPdf,
      measurements: [{ pelicula: 'Carbono Prime', tipoAplicacao: 'Janela', ambiente: 'Sala' }]
    } as SavedPDF;
    const { result } = buildHook({
      allSavedPdfs: [pdfWithService],
      setSchedulingInfo
    });

    act(() => {
      result.current.handleContinueAgendamento(agendamento);
    });

    expect(setSchedulingInfo).toHaveBeenCalledWith({
      agendamento: expect.objectContaining({
        clienteId: agendamento.clienteId,
        receiptDescription: expect.stringContaining('Carbono Prime'),
        stockSourcePdfIds: [10]
      })
    });
    const continuation = setSchedulingInfo.mock.calls[0][0].agendamento;
    expect(continuation).not.toHaveProperty('pdfId');
    expect(continuation).not.toHaveProperty('pdfIds');
  });

  it('informa erro quando salvar agendamento falha', async () => {
    const handleShowInfo = vi.fn();

    mockedDb.saveAgendamento.mockRejectedValue(new Error('falha ao salvar'));

    const { result } = buildHook({
      handleShowInfo
    });

    await expect(
      act(async () => {
        await result.current.handleSaveAgendamento({
          pdfId: 10,
          clienteId: 1,
          clienteNome: 'Cliente',
          start: agendamento.start,
          end: agendamento.end
        } as any);
      })
    ).rejects.toThrow('falha ao salvar');

    expect(handleShowInfo).toHaveBeenCalledWith('Não foi possível salvar o agendamento. Tente novamente.');
  });

  it('informa erro quando excluir agendamento falha e limpa selecao', async () => {
    const handleShowInfo = vi.fn();
    const setAgendamentoToDelete = vi.fn();

    mockedDb.getAllPDFs.mockResolvedValue([{ ...savedPdf, agendamentoId: 50 }]);
    mockedDb.deleteAgendamento.mockRejectedValue(new Error('falha ao excluir'));

    const { result } = buildHook({
      agendamentoToDelete: agendamento,
      handleShowInfo,
      setAgendamentoToDelete
    });

    await act(async () => {
      await result.current.handleConfirmDeleteAgendamento();
    });

    expect(handleShowInfo).toHaveBeenCalledWith('Não foi possível excluir o agendamento. Tente novamente.');
    expect(setAgendamentoToDelete).toHaveBeenCalledWith(null);
  });
});
