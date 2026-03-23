describe('syncService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('remove item da fila quando a sincronizacao conclui com sucesso', async () => {
    const queueItem = {
      id: 1,
      table: 'clients',
      action: 'create',
      data: {
        _localId: 'local_1',
        nome: 'Cliente Sync',
        telefone: '',
        email: '',
        cpfCnpj: ''
      },
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0
    };

    const deleteMock = vi.fn();
    const markAsSyncedMock = vi.fn();
    const saveClientRemoteMock = vi.fn().mockResolvedValue({ id: 77 });

    vi.doMock('./offlineDb', () => ({
      offlineDb: {
        syncQueue: {
          orderBy: vi.fn(() => ({
            toArray: vi.fn().mockResolvedValue([queueItem])
          })),
          delete: deleteMock
        }
      },
      getFailedSyncItems: vi.fn().mockResolvedValue([]),
      getFailedSyncCount: vi.fn().mockResolvedValue(0),
      getPendingSyncCount: vi.fn().mockResolvedValue(0),
      markSyncItemError: vi.fn(),
      markSyncItemPending: vi.fn(),
      markAsSynced: markAsSyncedMock
    }));

    vi.doMock('./supabaseDb', () => ({
      saveClientRemote: saveClientRemoteMock,
      deleteClientRemote: vi.fn(),
      saveCustomFilmRemote: vi.fn(),
      deleteCustomFilmRemote: vi.fn(),
      saveUserInfoRemote: vi.fn(),
      saveProposalOptionsRemote: vi.fn(),
      savePDFRemote: vi.fn(),
      saveAgendamentoRemote: vi.fn(),
      deleteAgendamentoRemote: vi.fn()
    }));

    const { syncAllPending } = await import('./syncService');

    await syncAllPending();

    expect(saveClientRemoteMock).toHaveBeenCalled();
    expect(markAsSyncedMock).toHaveBeenCalledWith('clients', 'local_1', 77);
    expect(deleteMock).toHaveBeenCalledWith(1);
  });

  it('mantem item na fila e marca erro quando a sincronizacao falha', async () => {
    const queueItem = {
      id: 2,
      table: 'clients',
      action: 'update',
      data: {
        _localId: 'local_2',
        _remoteId: 15,
        nome: 'Cliente Sync',
        telefone: '',
        email: '',
        cpfCnpj: ''
      },
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0
    };

    const deleteMock = vi.fn();
    const markSyncItemErrorMock = vi.fn();

    vi.doMock('./offlineDb', () => ({
      offlineDb: {
        syncQueue: {
          orderBy: vi.fn(() => ({
            toArray: vi.fn().mockResolvedValue([queueItem])
          })),
          delete: deleteMock
        }
      },
      getFailedSyncItems: vi.fn().mockResolvedValue([]),
      getFailedSyncCount: vi.fn().mockResolvedValue(1),
      getPendingSyncCount: vi.fn().mockResolvedValue(1),
      markSyncItemError: markSyncItemErrorMock,
      markSyncItemPending: vi.fn(),
      markAsSynced: vi.fn()
    }));

    vi.doMock('./supabaseDb', () => ({
      saveClientRemote: vi.fn().mockRejectedValue(new Error('falha remota')),
      deleteClientRemote: vi.fn(),
      saveCustomFilmRemote: vi.fn(),
      deleteCustomFilmRemote: vi.fn(),
      saveUserInfoRemote: vi.fn(),
      saveProposalOptionsRemote: vi.fn(),
      savePDFRemote: vi.fn(),
      saveAgendamentoRemote: vi.fn(),
      deleteAgendamentoRemote: vi.fn()
    }));

    const { syncAllPending } = await import('./syncService');

    await syncAllPending();

    expect(markSyncItemErrorMock).toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('recoloca item com status de erro em pending antes de tentar sincronizar novamente', async () => {
    const queueItem = {
      id: 3,
      table: 'clients',
      action: 'update',
      data: {
        _localId: 'local_3',
        _remoteId: 22,
        nome: 'Cliente Retry',
        telefone: '',
        email: '',
        cpfCnpj: ''
      },
      timestamp: Date.now(),
      status: 'error',
      retryCount: 2
    };

    const deleteMock = vi.fn();
    const markSyncItemPendingMock = vi.fn();
    const saveClientRemoteMock = vi.fn().mockResolvedValue({ id: 22 });

    vi.doMock('./offlineDb', () => ({
      offlineDb: {
        syncQueue: {
          orderBy: vi.fn(() => ({
            toArray: vi.fn().mockResolvedValue([queueItem])
          })),
          delete: deleteMock
        }
      },
      getFailedSyncItems: vi.fn().mockResolvedValue([]),
      getFailedSyncCount: vi.fn().mockResolvedValue(0),
      getPendingSyncCount: vi.fn().mockResolvedValue(0),
      markSyncItemError: vi.fn(),
      markSyncItemPending: markSyncItemPendingMock,
      markAsSynced: vi.fn()
    }));

    vi.doMock('./supabaseDb', () => ({
      saveClientRemote: saveClientRemoteMock,
      deleteClientRemote: vi.fn(),
      saveCustomFilmRemote: vi.fn(),
      deleteCustomFilmRemote: vi.fn(),
      saveUserInfoRemote: vi.fn(),
      saveProposalOptionsRemote: vi.fn(),
      savePDFRemote: vi.fn(),
      saveAgendamentoRemote: vi.fn(),
      deleteAgendamentoRemote: vi.fn()
    }));

    const { syncAllPending } = await import('./syncService');

    await syncAllPending();

    expect(markSyncItemPendingMock).toHaveBeenCalledWith(3);
    expect(saveClientRemoteMock).toHaveBeenCalled();
    expect(deleteMock).toHaveBeenCalledWith(3);
  });
});
