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
    const markProposalOptionsAsSyncedMock = vi.fn();
    const saveClientRemoteMock = vi.fn().mockResolvedValue({ id: 77 });

    vi.doMock('./offlineDb', () => ({
      offlineDb: {
        savedPdfs: {
          get: vi.fn().mockResolvedValue(undefined),
          filter: vi.fn(() => ({
            first: vi.fn().mockResolvedValue(undefined)
          }))
        },
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
      markAsSynced: markAsSyncedMock,
      markProposalOptionsAsSynced: markProposalOptionsAsSyncedMock
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
        savedPdfs: {
          get: vi.fn().mockResolvedValue(undefined),
          filter: vi.fn(() => ({
            first: vi.fn().mockResolvedValue(undefined)
          }))
        },
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
      markAsSynced: vi.fn(),
      markProposalOptionsAsSynced: vi.fn()
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
        savedPdfs: {
          get: vi.fn().mockResolvedValue(undefined),
          filter: vi.fn(() => ({
            first: vi.fn().mockResolvedValue(undefined)
          }))
        },
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
      markAsSynced: vi.fn(),
      markProposalOptionsAsSynced: vi.fn()
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

  it('interrompe a fila quando encontra erro de autenticacao expirada', async () => {
    const firstQueueItem = {
      id: 4,
      table: 'films',
      action: 'create',
      data: {
        _localId: 'film_local_1',
        nome: 'Film A'
      },
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0
    };

    const secondQueueItem = {
      id: 5,
      table: 'clients',
      action: 'create',
      data: {
        _localId: 'client_local_1',
        nome: 'Cliente B',
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
    const saveCustomFilmRemoteMock = vi.fn().mockRejectedValue({ code: 'PGRST303', message: 'JWT expired' });
    const saveClientRemoteMock = vi.fn();

    vi.doMock('./offlineDb', () => ({
      offlineDb: {
        syncQueue: {
          orderBy: vi.fn(() => ({
            toArray: vi.fn().mockResolvedValue([firstQueueItem, secondQueueItem])
          })),
          delete: deleteMock
        }
      },
      getFailedSyncItems: vi.fn().mockResolvedValue([]),
      getFailedSyncCount: vi.fn().mockResolvedValue(1),
      getPendingSyncCount: vi.fn().mockResolvedValue(1),
      markSyncItemError: markSyncItemErrorMock,
      markSyncItemPending: vi.fn(),
      markAsSynced: vi.fn(),
      markProposalOptionsAsSynced: vi.fn()
    }));

    vi.doMock('./supabaseDb', () => ({
      saveClientRemote: saveClientRemoteMock,
      deleteClientRemote: vi.fn(),
      saveCustomFilmRemote: saveCustomFilmRemoteMock,
      deleteCustomFilmRemote: vi.fn(),
      saveUserInfoRemote: vi.fn(),
      saveProposalOptionsRemote: vi.fn(),
      savePDFRemote: vi.fn(),
      saveAgendamentoRemote: vi.fn(),
      deleteAgendamentoRemote: vi.fn()
    }));

    const { syncAllPending } = await import('./syncService');

    await syncAllPending();

    expect(saveCustomFilmRemoteMock).toHaveBeenCalled();
    expect(saveClientRemoteMock).not.toHaveBeenCalled();
    expect(markSyncItemErrorMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('marca proposal options como sincronizadas apos salvar com sucesso', async () => {
    const queueItem = {
      id: 6,
      table: 'proposalOptions',
      action: 'update',
      data: {
        clientId: 15,
        options: [
          { id: 1, name: 'Opcao 1', measurements: [], generalDiscount: { value: '', type: 'percentage' } }
        ]
      },
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0
    };

    const deleteMock = vi.fn();
    const markProposalOptionsAsSyncedMock = vi.fn();
    const saveProposalOptionsRemoteMock = vi.fn().mockResolvedValue(undefined);

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
      markAsSynced: vi.fn(),
      markProposalOptionsAsSynced: markProposalOptionsAsSyncedMock
    }));

    vi.doMock('./supabaseDb', () => ({
      saveClientRemote: vi.fn(),
      deleteClientRemote: vi.fn(),
      saveCustomFilmRemote: vi.fn(),
      deleteCustomFilmRemote: vi.fn(),
      saveUserInfoRemote: vi.fn(),
      saveProposalOptionsRemote: saveProposalOptionsRemoteMock,
      savePDFRemote: vi.fn(),
      saveAgendamentoRemote: vi.fn(),
      deleteAgendamentoRemote: vi.fn()
    }));

    const { syncAllPending } = await import('./syncService');

    await syncAllPending();

    expect(saveProposalOptionsRemoteMock).toHaveBeenCalledWith(15, queueItem.data.options);
    expect(markProposalOptionsAsSyncedMock).toHaveBeenCalledWith(15);
    expect(deleteMock).toHaveBeenCalledWith(6);
  });

  it('sincroniza cliente temporario antes das opcoes de proposta', async () => {
    const temporaryClientId = 1779820343874;
    const queueItem = {
      id: 16,
      table: 'proposalOptions',
      action: 'update',
      data: {
        clientId: temporaryClientId,
        options: [
          { id: 1, name: 'Opcao Mobile', measurements: [], generalDiscount: { value: '', type: 'percentage' } }
        ]
      },
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0
    };

    const deleteMock = vi.fn();
    const markAsSyncedMock = vi.fn();
    const markProposalOptionsAsSyncedMock = vi.fn();
    const saveClientRemoteMock = vi.fn().mockResolvedValue({ id: 77 });
    const saveProposalOptionsRemoteMock = vi.fn().mockResolvedValue(undefined);

    vi.doMock('./offlineDb', () => ({
      offlineDb: {
        clients: {
          filter: vi.fn((predicate: (item: any) => boolean) => ({
            first: vi.fn().mockResolvedValue([
              {
                _localId: 'client_mobile_options',
                id: temporaryClientId,
                _remoteId: temporaryClientId,
                nome: 'Cliente Mobile',
                telefone: '',
                email: '',
                cpfCnpj: ''
              }
            ].find(predicate))
          }))
        },
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
      markAsSynced: markAsSyncedMock,
      markProposalOptionsAsSynced: markProposalOptionsAsSyncedMock
    }));

    vi.doMock('./supabaseDb', () => ({
      saveClientRemote: saveClientRemoteMock,
      deleteClientRemote: vi.fn(),
      saveCustomFilmRemote: vi.fn(),
      deleteCustomFilmRemote: vi.fn(),
      saveUserInfoRemote: vi.fn(),
      saveProposalOptionsRemote: saveProposalOptionsRemoteMock,
      savePDFRemote: vi.fn(),
      saveAgendamentoRemote: vi.fn(),
      deleteAgendamentoRemote: vi.fn()
    }));

    const { syncAllPending } = await import('./syncService');

    await syncAllPending();

    expect(saveClientRemoteMock).toHaveBeenCalledWith(expect.objectContaining({
      nome: 'Cliente Mobile'
    }));
    expect(saveProposalOptionsRemoteMock).toHaveBeenCalledWith(77, queueItem.data.options);
    expect(markAsSyncedMock).toHaveBeenCalledWith('clients', 'client_mobile_options', 77);
    expect(markProposalOptionsAsSyncedMock).toHaveBeenCalledWith(temporaryClientId);
    expect(deleteMock).toHaveBeenCalledWith(16);
  });

  it('sincroniza update de PDF mesmo quando o item nao traz pdfBlob', async () => {
    const queueItem = {
      id: 7,
      table: 'savedPdfs',
      action: 'update',
      data: {
        _localId: 'pdf_local_1',
        _remoteId: 91,
        id: 91,
        clienteId: 12,
        clientName: 'Cliente PDF',
        date: '2026-04-13',
        totalPreco: 100,
        totalM2: 2,
        nomeArquivo: 'orcamento.pdf',
        status: 'approved'
      },
      timestamp: Date.now(),
      status: 'error',
      retryCount: 3
    };

    const deleteMock = vi.fn();
    const markSyncItemPendingMock = vi.fn();
    const savePDFRemoteMock = vi.fn().mockResolvedValue({ id: 91 });

    vi.doMock('./offlineDb', () => ({
      offlineDb: {
        savedPdfs: {
          get: vi.fn().mockResolvedValue(undefined),
          filter: vi.fn(() => ({
            first: vi.fn().mockResolvedValue(undefined)
          }))
        },
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
      markAsSynced: vi.fn(),
      markProposalOptionsAsSynced: vi.fn()
    }));

    vi.doMock('./supabaseDb', () => ({
      saveClientRemote: vi.fn(),
      deleteClientRemote: vi.fn(),
      saveCustomFilmRemote: vi.fn(),
      deleteCustomFilmRemote: vi.fn(),
      saveUserInfoRemote: vi.fn(),
      saveProposalOptionsRemote: vi.fn(),
      savePDFRemote: savePDFRemoteMock,
      saveAgendamentoRemote: vi.fn(),
      deleteAgendamentoRemote: vi.fn()
    }));

    const { syncAllPending } = await import('./syncService');

    await syncAllPending();

    expect(markSyncItemPendingMock).toHaveBeenCalledWith(7);
    expect(savePDFRemoteMock).toHaveBeenCalledWith(expect.objectContaining({
      id: 91,
      clienteId: 12,
      clientName: 'Cliente PDF',
      nomeArquivo: 'orcamento.pdf',
      status: 'approved'
    }));
    expect(deleteMock).toHaveBeenCalledWith(7);
  });

  it('repara update de PDF com ID temporario negativo sincronizando como criacao', async () => {
    const queueItem = {
      id: 12,
      table: 'savedPdfs',
      action: 'update',
      data: {
        _localId: 'local_1779229179078_pdf',
        _remoteId: -1779229179078,
        id: -1779229179078,
        clienteId: 12,
        clientName: 'Cliente PDF',
        date: '2026-05-26T10:00:00.000Z',
        totalPreco: 280,
        totalM2: 2,
        pdfBlob: 'data:application/pdf;base64,JVBERi0xLjQ=',
        nomeArquivo: 'orcamento.pdf',
        status: 'approved'
      },
      timestamp: Date.now(),
      status: 'error',
      retryCount: 3
    };

    const deleteMock = vi.fn();
    const markSyncItemPendingMock = vi.fn();
    const markAsSyncedMock = vi.fn();
    const savePDFRemoteMock = vi.fn().mockResolvedValue({ id: 101 });

    vi.doMock('./offlineDb', () => ({
      offlineDb: {
        savedPdfs: {
          get: vi.fn().mockResolvedValue(undefined),
          filter: vi.fn(() => ({
            first: vi.fn().mockResolvedValue(undefined)
          }))
        },
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
      markAsSynced: markAsSyncedMock,
      markProposalOptionsAsSynced: vi.fn()
    }));

    vi.doMock('./supabaseDb', () => ({
      saveClientRemote: vi.fn(),
      deleteClientRemote: vi.fn(),
      saveCustomFilmRemote: vi.fn(),
      deleteCustomFilmRemote: vi.fn(),
      saveUserInfoRemote: vi.fn(),
      saveProposalOptionsRemote: vi.fn(),
      savePDFRemote: savePDFRemoteMock,
      saveAgendamentoRemote: vi.fn(),
      deleteAgendamentoRemote: vi.fn()
    }));

    const { syncAllPending } = await import('./syncService');

    await syncAllPending();

    const payload = savePDFRemoteMock.mock.calls[0][0];
    expect(payload).not.toHaveProperty('id');
    expect(payload).toMatchObject({
      clienteId: 12,
      clientName: 'Cliente PDF',
      nomeArquivo: 'orcamento.pdf',
      status: 'approved'
    });
    expect(markSyncItemPendingMock).toHaveBeenCalledWith(12);
    expect(markAsSyncedMock).toHaveBeenCalledWith('savedPdfs', 'local_1779229179078_pdf', 101);
    expect(deleteMock).toHaveBeenCalledWith(12);
  });

  it('normaliza referencias temporarias dentro do PDF antes de sincronizar', async () => {
    const temporaryClientId = -1779820343874;
    const queueItem = {
      id: 14,
      table: 'savedPdfs',
      action: 'update',
      data: {
        _localId: 'pdf_status_local',
        _remoteId: 91,
        id: 91,
        clienteId: temporaryClientId,
        clientName: 'Cliente PDF',
        date: '2026-05-26T10:00:00.000Z',
        totalPreco: 280,
        totalM2: 2,
        nomeArquivo: 'orcamento.pdf',
        status: 'approved',
        agendamentoId: -1779820208104,
        proposalOptionId: -1779555791103
      },
      timestamp: Date.now(),
      status: 'error',
      retryCount: 17
    };

    const deleteMock = vi.fn();
    const markAsSyncedMock = vi.fn();
    const savePDFRemoteMock = vi.fn().mockResolvedValue({ id: 91 });

    const collection = (records: any[]) => ({
      filter: vi.fn((predicate: (item: any) => boolean) => ({
        first: vi.fn().mockResolvedValue(records.find(predicate))
      }))
    });

    vi.doMock('./offlineDb', () => ({
      offlineDb: {
        clients: collection([
          {
            _localId: 'local_1779820343874_client',
            id: 12,
            _remoteId: 12,
            nome: 'Cliente PDF'
          }
        ]),
        agendamentos: collection([]),
        proposalOptions: collection([]),
        savedPdfs: {
          get: vi.fn().mockResolvedValue(undefined),
          filter: vi.fn(() => ({
            first: vi.fn().mockResolvedValue(undefined)
          }))
        },
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
      markAsSynced: markAsSyncedMock,
      markProposalOptionsAsSynced: vi.fn()
    }));

    vi.doMock('./supabaseDb', () => ({
      saveClientRemote: vi.fn(),
      deleteClientRemote: vi.fn(),
      saveCustomFilmRemote: vi.fn(),
      deleteCustomFilmRemote: vi.fn(),
      saveUserInfoRemote: vi.fn(),
      saveProposalOptionsRemote: vi.fn(),
      savePDFRemote: savePDFRemoteMock,
      saveAgendamentoRemote: vi.fn(),
      deleteAgendamentoRemote: vi.fn()
    }));

    const { syncAllPending } = await import('./syncService');

    await syncAllPending();

    const payload = savePDFRemoteMock.mock.calls[0][0];
    expect(payload).toMatchObject({
      id: 91,
      clienteId: 12,
      status: 'approved'
    });
    expect(payload).not.toHaveProperty('agendamentoId');
    expect(payload).not.toHaveProperty('proposalOptionId');
    expect(markAsSyncedMock).toHaveBeenCalledWith('savedPdfs', 'pdf_status_local', 91);
    expect(deleteMock).toHaveBeenCalledWith(14);
  });

  it('sincroniza cliente local temporario antes de enviar PDF local do celular', async () => {
    const temporaryClientId = 1779820343874;
    const queueItem = {
      id: 15,
      table: 'savedPdfs',
      action: 'create',
      data: {
        _localId: 'pdf_mobile_local',
        clienteId: temporaryClientId,
        clientName: 'Weverton Goncalves',
        date: '2026-05-26T10:00:00.000Z',
        totalPreco: 280,
        totalM2: 2,
        pdfBlob: 'data:application/pdf;base64,JVBERi0xLjQ=',
        nomeArquivo: 'orcamento.pdf',
        status: 'approved'
      },
      timestamp: Date.now(),
      status: 'error',
      retryCount: 4
    };

    const deleteMock = vi.fn();
    const markAsSyncedMock = vi.fn();
    const saveClientRemoteMock = vi.fn().mockResolvedValue({ id: 77 });
    const savePDFRemoteMock = vi.fn().mockResolvedValue({ id: 91 });

    vi.doMock('./offlineDb', () => ({
      offlineDb: {
        clients: {
          filter: vi.fn((predicate: (item: any) => boolean) => ({
            first: vi.fn().mockResolvedValue([
              {
                _localId: 'client_mobile_local',
                id: temporaryClientId,
                _remoteId: temporaryClientId,
                nome: 'Weverton Goncalves',
                telefone: '',
                email: '',
                cpfCnpj: ''
              }
            ].find(predicate))
          }))
        },
        savedPdfs: {
          get: vi.fn().mockResolvedValue(undefined),
          filter: vi.fn(() => ({
            first: vi.fn().mockResolvedValue(undefined)
          }))
        },
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
      markAsSynced: markAsSyncedMock,
      markProposalOptionsAsSynced: vi.fn()
    }));

    vi.doMock('./supabaseDb', () => ({
      saveClientRemote: saveClientRemoteMock,
      deleteClientRemote: vi.fn(),
      saveCustomFilmRemote: vi.fn(),
      deleteCustomFilmRemote: vi.fn(),
      saveUserInfoRemote: vi.fn(),
      saveProposalOptionsRemote: vi.fn(),
      savePDFRemote: savePDFRemoteMock,
      saveAgendamentoRemote: vi.fn(),
      deleteAgendamentoRemote: vi.fn()
    }));

    const { syncAllPending } = await import('./syncService');

    await syncAllPending();

    expect(saveClientRemoteMock).toHaveBeenCalledWith(expect.objectContaining({
      nome: 'Weverton Goncalves'
    }));
    expect(savePDFRemoteMock).toHaveBeenCalledWith(expect.objectContaining({
      clienteId: 77,
      clientName: 'Weverton Goncalves',
      status: 'approved'
    }));
    expect(markAsSyncedMock).toHaveBeenCalledWith('clients', 'client_mobile_local', 77);
    expect(markAsSyncedMock).toHaveBeenCalledWith('savedPdfs', 'pdf_mobile_local', 91);
    expect(deleteMock).toHaveBeenCalledWith(15);
  });

  it('reaponta update legado de PDF temporario para o remoto ja criado', async () => {
    const queueItem = {
      id: 13,
      table: 'savedPdfs',
      action: 'update',
      data: {
        _localId: 'local_status_1',
        _remoteId: -1779229179078,
        id: -1779229179078,
        clienteId: 12,
        clientName: 'Cliente PDF',
        date: '2026-05-26T10:00:00.000Z',
        totalPreco: 280,
        totalM2: 2,
        pdfBlob: 'data:application/pdf;base64,JVBERi0xLjQ=',
        nomeArquivo: 'orcamento.pdf',
        status: 'approved'
      },
      timestamp: Date.now(),
      status: 'error',
      retryCount: 3
    };

    const deleteMock = vi.fn();
    const markAsSyncedMock = vi.fn();
    const savePDFRemoteMock = vi.fn().mockResolvedValue({ id: 101 });

    vi.doMock('./offlineDb', () => ({
      offlineDb: {
        savedPdfs: {
          get: vi.fn().mockResolvedValue({
            _localId: 'local_status_1',
            id: -1779229179078,
            _remoteId: -1779229179078
          }),
          filter: vi.fn(() => ({
            first: vi.fn().mockResolvedValue({
              _localId: 'local_1779229179078_pdf',
              id: 101,
              _remoteId: 101
            })
          }))
        },
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
      markAsSynced: markAsSyncedMock,
      markProposalOptionsAsSynced: vi.fn()
    }));

    vi.doMock('./supabaseDb', () => ({
      saveClientRemote: vi.fn(),
      deleteClientRemote: vi.fn(),
      saveCustomFilmRemote: vi.fn(),
      deleteCustomFilmRemote: vi.fn(),
      saveUserInfoRemote: vi.fn(),
      saveProposalOptionsRemote: vi.fn(),
      savePDFRemote: savePDFRemoteMock,
      saveAgendamentoRemote: vi.fn(),
      deleteAgendamentoRemote: vi.fn()
    }));

    const { syncAllPending } = await import('./syncService');

    await syncAllPending();

    expect(savePDFRemoteMock).toHaveBeenCalledWith(expect.objectContaining({
      id: 101,
      status: 'approved'
    }));
    expect(markAsSyncedMock).toHaveBeenCalledWith('savedPdfs', 'local_status_1', 101);
    expect(deleteMock).toHaveBeenCalledWith(13);
  });

  it('descarta erro legado de savedPdfs que ja foi sincronizado localmente', async () => {
    const queueItem = {
      id: 8,
      table: 'savedPdfs',
      action: 'update',
      data: {
        _localId: 'pdf_local_synced',
        _remoteId: 92,
        status: 'approved'
      },
      timestamp: Date.now() - 10_000,
      status: 'error',
      retryCount: 158,
      lastError: "savedPdfs: Failed to execute 'readAsDataURL' on 'FileReader': parameter 1 is not of type 'Blob'.",
      lastAttemptAt: Date.now() - 5_000
    };

    const deleteMock = vi.fn();
    const savePDFRemoteMock = vi.fn();

    vi.doMock('./offlineDb', () => ({
      offlineDb: {
        savedPdfs: {
          get: vi.fn().mockResolvedValue({
            _localId: 'pdf_local_synced',
            _syncStatus: 'synced',
            _syncedAt: Date.now(),
            _remoteId: 92
          }),
          filter: vi.fn(() => ({
            first: vi.fn().mockResolvedValue(undefined)
          }))
        },
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
      markAsSynced: vi.fn(),
      markProposalOptionsAsSynced: vi.fn()
    }));

    vi.doMock('./supabaseDb', () => ({
      saveClientRemote: vi.fn(),
      deleteClientRemote: vi.fn(),
      saveCustomFilmRemote: vi.fn(),
      deleteCustomFilmRemote: vi.fn(),
      saveUserInfoRemote: vi.fn(),
      saveProposalOptionsRemote: vi.fn(),
      savePDFRemote: savePDFRemoteMock,
      saveAgendamentoRemote: vi.fn(),
      deleteAgendamentoRemote: vi.fn()
    }));

    const { syncAllPending } = await import('./syncService');

    await syncAllPending();

    expect(savePDFRemoteMock).not.toHaveBeenCalled();
    expect(deleteMock).toHaveBeenCalledWith(8);
  });

  it('resolve IDs temporarios antes de sincronizar agendamento', async () => {
    const queueItem = {
      id: 9,
      table: 'agendamentos',
      action: 'create',
      data: {
        _localId: 'agenda_local_1',
        pdfId: -1779229179078,
        clienteId: -1779229179000,
        clienteNome: 'Cliente Agenda',
        start: '2026-05-20T09:00:00.000Z',
        end: '2026-05-20T11:00:00.000Z'
      },
      timestamp: Date.now(),
      status: 'error',
      retryCount: 8
    };

    const deleteMock = vi.fn();
    const markAsSyncedMock = vi.fn();
    const saveAgendamentoRemoteMock = vi.fn().mockResolvedValue({ id: 55 });

    vi.doMock('./offlineDb', () => ({
      offlineDb: {
        clients: {
          filter: vi.fn(() => ({
            first: vi.fn().mockResolvedValue({
              id: -1779229179000,
              _remoteId: 12
            })
          }))
        },
        savedPdfs: {
          get: vi.fn().mockResolvedValue(undefined),
          filter: vi.fn(() => ({
            first: vi.fn().mockResolvedValue({
              id: -1779229179078,
              _remoteId: 91
            })
          }))
        },
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
      markAsSynced: markAsSyncedMock,
      markProposalOptionsAsSynced: vi.fn()
    }));

    vi.doMock('./supabaseDb', () => ({
      saveClientRemote: vi.fn(),
      deleteClientRemote: vi.fn(),
      saveCustomFilmRemote: vi.fn(),
      deleteCustomFilmRemote: vi.fn(),
      saveUserInfoRemote: vi.fn(),
      saveProposalOptionsRemote: vi.fn(),
      savePDFRemote: vi.fn(),
      saveAgendamentoRemote: saveAgendamentoRemoteMock,
      deleteAgendamentoRemote: vi.fn()
    }));

    const { syncAllPending } = await import('./syncService');

    await syncAllPending();

    expect(saveAgendamentoRemoteMock).toHaveBeenCalledWith(expect.objectContaining({
      pdfId: 91,
      clienteId: 12,
      clienteNome: 'Cliente Agenda'
    }));
    expect(markAsSyncedMock).toHaveBeenCalledWith('agendamentos', 'agenda_local_1', 55);
    expect(deleteMock).toHaveBeenCalledWith(9);
  });

  it('remove IDs temporarios sem remoto antes de sincronizar agendamento', async () => {
    const queueItem = {
      id: 10,
      table: 'agendamentos',
      action: 'create',
      data: {
        _localId: 'agenda_local_2',
        pdfId: -1779229179078,
        clienteId: -1779229179000,
        clienteNome: 'Cliente sem remoto',
        start: '2026-05-20T09:00:00.000Z',
        end: '2026-05-20T11:00:00.000Z'
      },
      timestamp: Date.now(),
      status: 'error',
      retryCount: 8
    };

    const deleteMock = vi.fn();
    const saveAgendamentoRemoteMock = vi.fn().mockResolvedValue({ id: 56 });

    vi.doMock('./offlineDb', () => ({
      offlineDb: {
        clients: {
          filter: vi.fn(() => ({
            first: vi.fn().mockResolvedValue(undefined)
          }))
        },
        savedPdfs: {
          get: vi.fn().mockResolvedValue(undefined),
          filter: vi.fn(() => ({
            first: vi.fn().mockResolvedValue(undefined)
          }))
        },
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
      markAsSynced: vi.fn(),
      markProposalOptionsAsSynced: vi.fn()
    }));

    vi.doMock('./supabaseDb', () => ({
      saveClientRemote: vi.fn(),
      deleteClientRemote: vi.fn(),
      saveCustomFilmRemote: vi.fn(),
      deleteCustomFilmRemote: vi.fn(),
      saveUserInfoRemote: vi.fn(),
      saveProposalOptionsRemote: vi.fn(),
      savePDFRemote: vi.fn(),
      saveAgendamentoRemote: saveAgendamentoRemoteMock,
      deleteAgendamentoRemote: vi.fn()
    }));

    const { syncAllPending } = await import('./syncService');

    await syncAllPending();

    const payload = saveAgendamentoRemoteMock.mock.calls[0][0];
    expect(payload).not.toHaveProperty('pdfId');
    expect(payload).not.toHaveProperty('clienteId');
    expect(payload.clienteNome).toBe('Cliente sem remoto');
    expect(deleteMock).toHaveBeenCalledWith(10);
  });
});
