import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { useClientFlow } from './useClientFlow';
import { usePdfActions } from './usePdfActions';
import { useProposalEditor } from './useProposalEditor';
import { useProposalTotals } from './useProposalTotals';
import * as db from '../../services/db';
import { Client, UserInfo } from '../../types';

vi.mock('../../services/db', () => ({
  saveClient: vi.fn(),
  saveUserInfo: vi.fn(),
  deleteClient: vi.fn(),
  deleteProposalOptions: vi.fn(),
  getPDFsForClient: vi.fn(),
  deletePDF: vi.fn(),
  getProposalOptions: vi.fn(),
  saveProposalOptions: vi.fn(),
  savePDF: vi.fn(),
  getAllPDFs: vi.fn(),
  updatePDF: vi.fn(),
  saveAgendamento: vi.fn(),
  deleteAgendamento: vi.fn()
}));

vi.mock('../../services/pdfGenerator', () => ({
  generatePDF: vi.fn(),
  generateCombinedPDF: vi.fn()
}));

const mockedDb = vi.mocked(db);

describe('flow journeys', () => {
  const userInfo: UserInfo = {
    id: 'info',
    nome: 'Alex',
    empresa: 'Peliculas BR',
    telefone: '83999990000',
    email: 'alex@teste.com',
    endereco: 'Rua Teste',
    cpfCnpj: '',
    payment_methods: [],
    proposalValidityDays: 30
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('permite criar cliente, montar proposta e gerar PDF na mesma jornada', async () => {
    const createdClient: Client = {
      id: 9,
      nome: 'Cliente Jornada',
      telefone: '83988887777',
      email: 'jornada@teste.com',
      cpfCnpj: ''
    };

    const films = [{ nome: 'Blackout', preco: 120 }];
    const loadClients = vi.fn().mockResolvedValue(undefined);

    mockedDb.saveClient.mockResolvedValue(createdClient);
    mockedDb.getProposalOptions.mockResolvedValue([]);
    mockedDb.saveProposalOptions.mockResolvedValue(undefined as never);
    mockedDb.savePDF.mockResolvedValue({
      id: 77,
      clienteId: 9,
      date: new Date().toISOString(),
      totalPreco: 240,
      totalM2: 2,
      nomeArquivo: 'orcamento.pdf'
    } as never);

    const pdfModule = await import('../../services/pdfGenerator');
    vi.mocked(pdfModule.generatePDF).mockResolvedValue(
      new Blob(['pdf'], { type: 'application/pdf' }) as never
    );

    const setSelectedClientId = vi.fn();
    const setAllSavedPdfs = vi.fn();
    const setPdfGenerationStatus = vi.fn();

    const clientFlow = renderHook(() =>
      useClientFlow({
        clients: [],
        setClients: vi.fn(),
        setAllSavedPdfs: vi.fn(),
        setAgendamentos: vi.fn(),
        selectedClientId: null,
        setSelectedClientId,
        setActiveTab: vi.fn(),
        setActiveOptionId: vi.fn(),
        userInfo,
        setUserInfo: vi.fn(),
        clientModalMode: 'add',
        postClientSaveAction: null,
        setPostClientSaveAction: vi.fn(),
        setClientTransitionKey: vi.fn(),
        setIsClientModalOpen: vi.fn(),
        setNewClientName: vi.fn(),
        setAiClientData: vi.fn(),
        setIsDeleteClientModalOpen: vi.fn(),
        setIsDeletingClient: vi.fn(),
        loadClients,
        loadAllPdfs: vi.fn().mockResolvedValue(undefined),
        loadAgendamentos: vi.fn().mockResolvedValue(undefined),
        hasLoadedHistory: false,
        hasLoadedAgendamentos: false,
        handleOpenAgendamentoModal: vi.fn(),
        handleShowInfo: vi.fn()
      })
    );

    await act(async () => {
      await clientFlow.result.current.handleSaveClient({
        nome: createdClient.nome,
        telefone: createdClient.telefone,
        email: createdClient.email,
        cpfCnpj: createdClient.cpfCnpj
      });
    });

    expect(loadClients).toHaveBeenCalledWith(9);

    const proposalEditor = renderHook(() =>
      useProposalEditor({
        selectedClientId: 9,
        films,
        loadClients
      })
    );

    await waitFor(() => {
      expect(proposalEditor.result.current.activeOption?.name).toBe('Opcao 1');
    });

    act(() => {
      proposalEditor.result.current.addMeasurement();
    });

    act(() => {
      proposalEditor.result.current.handleMeasurementsChange([
        {
          ...proposalEditor.result.current.measurements[0],
          largura: '2',
          altura: '1',
          quantidade: 1,
          ambiente: 'Sala',
          tipoAplicacao: 'Interna',
          pelicula: 'Blackout',
          active: true
        }
      ]);
    });

    const totalsHook = renderHook(() =>
      useProposalTotals({
        measurements: proposalEditor.result.current.measurements,
        films,
        generalDiscount: proposalEditor.result.current.generalDiscount
      })
    );

    const pdfActions = renderHook(() =>
      usePdfActions({
        measurements: proposalEditor.result.current.measurements,
        films,
        generalDiscount: proposalEditor.result.current.generalDiscount,
        totals: totalsHook.result.current,
        selectedClient: createdClient,
        selectedClientId: 9,
        userInfo,
        activeOption: proposalEditor.result.current.activeOption,
        clients: [createdClient],
        setAllSavedPdfs,
        setPdfGenerationStatus,
        setIsSaveBeforePdfModalOpen: vi.fn(),
        handleShowInfo: vi.fn(),
        handleSaveChanges: proposalEditor.result.current.handleSaveChanges
      })
    );

    await act(async () => {
      await pdfActions.result.current.handleConfirmSaveBeforePdf();
    });

    expect(mockedDb.saveProposalOptions).toHaveBeenCalledWith(
      9,
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Opcao 1',
          measurements: expect.arrayContaining([
            expect.objectContaining({
              pelicula: 'Blackout',
              largura: '2',
              altura: '1'
            })
          ])
        })
      ])
    );
    expect(mockedDb.savePDF).toHaveBeenCalled();
    expect(setPdfGenerationStatus).toHaveBeenCalledWith('success');
    expect(setAllSavedPdfs).toHaveBeenCalled();
  });

  it('remove cliente do frontend imediatamente ao excluir, sem esperar recarga', async () => {
    const clients: Client[] = [
      { id: 1, nome: 'Cliente A', telefone: '', email: '', cpfCnpj: '' },
      { id: 2, nome: 'Cliente B', telefone: '', email: '', cpfCnpj: '' }
    ];

    mockedDb.deleteClient.mockResolvedValue(undefined as never);
    mockedDb.deleteProposalOptions.mockResolvedValue(undefined as never);
    mockedDb.getPDFsForClient.mockResolvedValue([]);

    const setClients = vi.fn();
    const setSelectedClientId = vi.fn();
    const setAllSavedPdfs = vi.fn();
    const setAgendamentos = vi.fn();

    const { result } = renderHook(() =>
      useClientFlow({
        clients,
        setClients,
        setAllSavedPdfs,
        setAgendamentos,
        selectedClientId: 1,
        setSelectedClientId,
        setActiveTab: vi.fn(),
        setActiveOptionId: vi.fn(),
        userInfo,
        setUserInfo: vi.fn(),
        clientModalMode: 'edit',
        postClientSaveAction: null,
        setPostClientSaveAction: vi.fn(),
        setClientTransitionKey: vi.fn(),
        setIsClientModalOpen: vi.fn(),
        setNewClientName: vi.fn(),
        setAiClientData: vi.fn(),
        setIsDeleteClientModalOpen: vi.fn(),
        setIsDeletingClient: vi.fn(),
        loadClients: vi.fn().mockResolvedValue(undefined),
        loadAllPdfs: vi.fn().mockResolvedValue(undefined),
        loadAgendamentos: vi.fn().mockResolvedValue(undefined),
        hasLoadedHistory: false,
        hasLoadedAgendamentos: false,
        handleOpenAgendamentoModal: vi.fn(),
        handleShowInfo: vi.fn()
      })
    );

    await act(async () => {
      await result.current.handleConfirmDeleteClient();
    });

    const updateClients = setClients.mock.calls[0][0];
    expect(updateClients(clients)).toEqual([
      { id: 2, nome: 'Cliente B', telefone: '', email: '', cpfCnpj: '' }
    ]);
    expect(setSelectedClientId).toHaveBeenCalled();
  });
});
