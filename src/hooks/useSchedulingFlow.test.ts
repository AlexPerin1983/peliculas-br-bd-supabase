import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { useSchedulingFlow } from './useSchedulingFlow';
import * as db from '../../services/db';
import { Agendamento, SavedPDF } from '../../types';

vi.mock('../../services/db', () => ({
  saveAgendamento: vi.fn(),
  getAllPDFs: vi.fn(),
  updatePDF: vi.fn(),
  deleteAgendamento: vi.fn()
}));

const mockedDb = vi.mocked(db);

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

    expect(handleShowInfo).toHaveBeenCalledWith('Nao foi possivel salvar o agendamento. Tente novamente.');
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

    expect(handleShowInfo).toHaveBeenCalledWith('Nao foi possivel excluir o agendamento. Tente novamente.');
    expect(setAgendamentoToDelete).toHaveBeenCalledWith(null);
  });
});
