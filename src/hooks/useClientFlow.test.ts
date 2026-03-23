import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { useClientFlow } from './useClientFlow';
import { Client, UserInfo } from '../../types';
import * as db from '../../services/db';

vi.mock('../../services/db', () => ({
  saveClient: vi.fn(),
  saveUserInfo: vi.fn(),
  deleteClient: vi.fn(),
  deleteProposalOptions: vi.fn(),
  getPDFsForClient: vi.fn(),
  deletePDF: vi.fn()
}));

const mockedDb = vi.mocked(db);

describe('useClientFlow', () => {
  const clients: Client[] = [
    {
      id: 1,
      nome: 'Cliente Atual',
      telefone: '83999990000',
      email: 'cliente@teste.com',
      cpfCnpj: ''
    }
  ];

  const userInfo: UserInfo = {
    id: 'info',
    nome: 'Alex',
    empresa: 'Peliculas BR',
    telefone: '83999990000',
    email: 'alex@teste.com',
    endereco: 'Rua Teste',
    cpfCnpj: '',
    payment_methods: [],
    lastSelectedClientId: 1
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function buildHook(overrides: Partial<Parameters<typeof useClientFlow>[0]> = {}) {
    return renderHook(() =>
      useClientFlow({
        clients,
        setClients: vi.fn(),
        setAllSavedPdfs: vi.fn(),
        setAgendamentos: vi.fn(),
        selectedClientId: 1,
        setSelectedClientId: vi.fn(),
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
        loadClients: vi.fn().mockResolvedValue(undefined),
        loadAllPdfs: vi.fn().mockResolvedValue(undefined),
        loadAgendamentos: vi.fn().mockResolvedValue(undefined),
        hasLoadedHistory: false,
        hasLoadedAgendamentos: false,
        handleOpenAgendamentoModal: vi.fn(),
        ...overrides
      })
    );
  }

  it('salva um novo cliente e recarrega a lista selecionando o cliente salvo', async () => {
    const loadClients = vi.fn().mockResolvedValue(undefined);
    const setIsClientModalOpen = vi.fn();
    const setNewClientName = vi.fn();
    const setAiClientData = vi.fn();

    mockedDb.saveClient.mockResolvedValue({
      id: 9,
      nome: 'Cliente Novo',
      telefone: '83988887777',
      email: 'novo@teste.com',
      cpfCnpj: ''
    });

    const { result } = buildHook({
      loadClients,
      setIsClientModalOpen,
      setNewClientName,
      setAiClientData
    });

    await act(async () => {
      await result.current.handleSaveClient({
        nome: 'Cliente Novo',
        telefone: '83988887777',
        email: 'novo@teste.com',
        cpfCnpj: ''
      });
    });

    expect(mockedDb.saveClient).toHaveBeenCalledWith({
      nome: 'Cliente Novo',
      telefone: '83988887777',
      email: 'novo@teste.com',
      cpfCnpj: ''
    });
    expect(loadClients).toHaveBeenCalledWith(9);
    expect(setIsClientModalOpen).toHaveBeenCalledWith(false);
    expect(setNewClientName).toHaveBeenCalledWith('');
    expect(setAiClientData).toHaveBeenCalledWith(undefined);
  });

  it('salva em modo de edicao usando o selectedClientId', async () => {
    const loadClients = vi.fn().mockResolvedValue(undefined);

    mockedDb.saveClient.mockResolvedValue({
      id: 1,
      nome: 'Cliente Atualizado',
      telefone: '83999990000',
      email: 'cliente@teste.com',
      cpfCnpj: ''
    });

    const { result } = buildHook({
      clientModalMode: 'edit',
      loadClients
    });

    await act(async () => {
      await result.current.handleSaveClient({
        nome: 'Cliente Atualizado',
        telefone: '83999990000',
        email: 'cliente@teste.com',
        cpfCnpj: ''
      });
    });

    expect(mockedDb.saveClient).toHaveBeenCalledWith({
      id: 1,
      nome: 'Cliente Atualizado',
      telefone: '83999990000',
      email: 'cliente@teste.com',
      cpfCnpj: ''
    });
    expect(loadClients).toHaveBeenCalledWith(1);
  });

  it('abre agendamento apos salvar quando ha acao pendente', async () => {
    const handleOpenAgendamentoModal = vi.fn();
    const setPostClientSaveAction = vi.fn();

    mockedDb.saveClient.mockResolvedValue({
      id: 15,
      nome: 'Cliente Agenda',
      telefone: '83911112222',
      email: 'agenda@teste.com',
      cpfCnpj: ''
    });

    const { result } = buildHook({
      postClientSaveAction: 'openAgendamentoModal',
      handleOpenAgendamentoModal,
      setPostClientSaveAction
    });

    await act(async () => {
      await result.current.handleSaveClient({
        nome: 'Cliente Agenda',
        telefone: '83911112222',
        email: 'agenda@teste.com',
        cpfCnpj: ''
      });
    });

    expect(handleOpenAgendamentoModal).toHaveBeenCalledWith({
      agendamento: { clienteId: 15 }
    });
    expect(setPostClientSaveAction).toHaveBeenCalledWith(null);
  });

  it('navega para uma opcao de proposta de outro cliente', () => {
    const setActiveTab = vi.fn();
    const setSelectedClientId = vi.fn();
    const setActiveOptionId = vi.fn();

    const { result } = buildHook({
      setActiveTab,
      setSelectedClientId,
      setActiveOptionId
    });

    act(() => {
      result.current.handleNavigateToOption(8, 22);
    });

    expect(setActiveTab).toHaveBeenCalledWith('client');
    expect(setSelectedClientId).toHaveBeenCalledWith(8);
    expect(setActiveOptionId).toHaveBeenCalledWith(22);
  });

  it('fixa e desafixa cliente recarregando a lista', async () => {
    const loadClients = vi.fn().mockResolvedValue(undefined);

    mockedDb.saveClient.mockResolvedValue(undefined as any);

    const { result } = buildHook({ loadClients });

    await act(async () => {
      await result.current.handleToggleClientPin(1);
    });

    expect(mockedDb.saveClient).toHaveBeenCalledWith({
      ...clients[0],
      pinned: true,
      pinnedAt: expect.any(Number)
    });
    expect(loadClients).toHaveBeenCalled();
  });
});
