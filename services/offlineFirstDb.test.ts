describe('offlineFirstDb userInfo', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('nao grava fallback/mock no cache local durante bootstrap online', async () => {
    const putMock = vi.fn();
    const fallbackUserInfo = {
      id: 'info' as const,
      nome: 'Alex Renato Lacerda Perin',
      empresa: 'Peliculas Brasil',
      telefone: '',
      email: '',
      endereco: '',
      cpfCnpj: '',
      payment_methods: [],
      isFallback: true
    };

    vi.doMock('./offlineDb', () => ({
      offlineDb: {
        userInfo: {
          put: putMock
        }
      },
      getUserInfoLocal: vi.fn().mockResolvedValue(null),
      saveUserInfoLocal: vi.fn(),
      LocalUserInfo: {}
    }));

    vi.doMock('./supabaseDb', () => ({
      getUserInfo: vi.fn().mockResolvedValue(fallbackUserInfo),
      updatePaymentMethodsOnly: vi.fn(),
      updateAIConfigOnly: vi.fn(),
      updateLastSelectedClientIdOnly: vi.fn()
    }));

    vi.doMock('./syncService', () => ({
      isOnlineNow: vi.fn().mockReturnValue(true),
      syncAllPending: vi.fn()
    }));

    const { getUserInfo } = await import('./offlineFirstDb');

    const result = await getUserInfo();

    expect(result).toEqual(fallbackUserInfo);
    expect(putMock).not.toHaveBeenCalled();
  });

  it('mantem proposal options locais pendentes quando online para nao perder edicoes recentes', async () => {
    const localPendingOptions = [
      {
        id: 10,
        name: 'Opcao Local',
        measurements: [{ id: 1, largura: '0,74', altura: '0,85', quantidade: 4 }],
        generalDiscount: { value: '', type: 'percentage' },
        clientId: 123,
        _localId: 'local_proposal_1',
        _syncStatus: 'pending',
        _lastModified: Date.now()
      }
    ];

    const syncAllPendingMock = vi.fn().mockResolvedValue(undefined);
    const getProposalOptionsRemoteMock = vi.fn().mockResolvedValue([
      {
        id: 99,
        name: 'Opcao Remota Antiga',
        measurements: [{ id: 1, largura: '0,74', altura: '0,85', quantidade: 1 }],
        generalDiscount: { value: '', type: 'percentage' }
      }
    ]);

    vi.doMock('./offlineDb', () => ({
      offlineDb: {
        proposalOptions: {
          put: vi.fn()
        }
      },
      getUserInfoLocal: vi.fn(),
      saveUserInfoLocal: vi.fn(),
      getProposalOptionsLocal: vi.fn().mockResolvedValue(localPendingOptions),
      replaceProposalOptionsCache: vi.fn()
    }));

    vi.doMock('./supabaseDb', () => ({
      getUserInfo: vi.fn(),
      updatePaymentMethodsOnly: vi.fn(),
      updateAIConfigOnly: vi.fn(),
      updateLastSelectedClientIdOnly: vi.fn(),
      getProposalOptions: getProposalOptionsRemoteMock
    }));

    vi.doMock('./syncService', () => ({
      isOnlineNow: vi.fn().mockReturnValue(true),
      syncAllPending: syncAllPendingMock
    }));

    const { getProposalOptions } = await import('./offlineFirstDb');

    const result = await getProposalOptions(123);

    expect(result).toEqual([
      {
        id: 10,
        name: 'Opcao Local',
        measurements: [{ id: 1, largura: '0,74', altura: '0,85', quantidade: 4 }],
        generalDiscount: { value: '', type: 'percentage' }
      }
    ]);
    expect(syncAllPendingMock).toHaveBeenCalled();
    expect(getProposalOptionsRemoteMock).not.toHaveBeenCalled();
  });

  it('mantem status local pendente de PDFs quando a leitura remota ainda esta atrasada', async () => {
    const syncAllPendingMock = vi.fn().mockResolvedValue(undefined);
    const remotePdf = {
      id: 42,
      clienteId: 7,
      clientName: 'Cliente A',
      date: '2026-05-23T10:00:00.000Z',
      totalPreco: 1000,
      totalM2: 4,
      nomeArquivo: 'orcamento-a.pdf',
      status: 'pending' as const
    };
    const localApprovedPdf = {
      ...remotePdf,
      status: 'approved' as const,
      _localId: 'local_1000_pdf',
      _syncStatus: 'pending' as const,
      _lastModified: 1000,
      _remoteId: 42
    };

    vi.doMock('./offlineDb', () => ({
      getAllPdfsLocal: vi.fn().mockResolvedValue([localApprovedPdf])
    }));

    vi.doMock('./supabaseDb', () => ({
      getAllPDFs: vi.fn().mockResolvedValue([remotePdf])
    }));

    vi.doMock('./syncService', () => ({
      isOnlineNow: vi.fn().mockReturnValue(true),
      syncAllPending: syncAllPendingMock
    }));

    const { getAllPDFs } = await import('./offlineFirstDb');

    const result = await getAllPDFs();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 42,
      status: 'approved'
    });
    expect(syncAllPendingMock).toHaveBeenCalled();
  });

  it('exibe cliente local pendente com ID temporario negativo quando estiver offline', async () => {
    vi.doMock('./offlineDb', () => ({
      getAllClientsLocal: vi.fn().mockResolvedValue([
        {
          id: 1779820343874,
          _localId: 'local_1779820343874_client',
          _syncStatus: 'pending',
          _lastModified: Date.now(),
          nome: 'Cliente Mobile',
          telefone: '',
          email: '',
          cpfCnpj: ''
        }
      ])
    }));

    vi.doMock('./supabaseDb', () => ({
      getAllClients: vi.fn()
    }));

    vi.doMock('./syncService', () => ({
      isOnlineNow: vi.fn().mockReturnValue(false),
      syncAllPending: vi.fn()
    }));

    const { getAllClients } = await import('./offlineFirstDb');

    const result = await getAllClients();

    expect(result).toEqual([
      expect.objectContaining({
        id: -1779820343874,
        nome: 'Cliente Mobile'
      })
    ]);
  });

  it('enfileira agendamento enquanto a proposta ainda tem ID temporario', async () => {
    const temporaryPdfId = -1784805973427;
    const saveAgendamentoLocalMock = vi.fn().mockResolvedValue({
      _localId: 'local_1784806000000_agendamento',
      _syncStatus: 'pending',
      _lastModified: Date.now(),
      pdfId: temporaryPdfId,
      pdfIds: [temporaryPdfId],
      clienteId: 12,
      clienteNome: 'Cliente Agenda',
      start: '2026-07-23T09:00:00.000Z',
      end: '2026-07-23T10:00:00.000Z'
    });
    const updateMock = vi.fn();
    const saveAgendamentoRemoteMock = vi.fn();
    const syncAllPendingMock = vi.fn().mockResolvedValue(undefined);

    vi.doMock('./offlineDb', () => ({
      saveAgendamentoLocal: saveAgendamentoLocalMock,
      offlineDb: {
        agendamentos: {
          update: updateMock,
          put: vi.fn()
        }
      }
    }));

    vi.doMock('./supabaseDb', () => ({
      saveAgendamento: saveAgendamentoRemoteMock
    }));

    vi.doMock('./syncService', () => ({
      isOnlineNow: vi.fn().mockReturnValue(true),
      syncAllPending: syncAllPendingMock
    }));

    const { saveAgendamento } = await import('./offlineFirstDb');
    const result = await saveAgendamento({
      pdfId: temporaryPdfId,
      pdfIds: [temporaryPdfId],
      clienteId: 12,
      clienteNome: 'Cliente Agenda',
      start: '2026-07-23T09:00:00.000Z',
      end: '2026-07-23T10:00:00.000Z'
    });

    expect(saveAgendamentoRemoteMock).not.toHaveBeenCalled();
    expect(saveAgendamentoLocalMock).toHaveBeenCalled();
    expect(syncAllPendingMock).toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith('local_1784806000000_agendamento', {
      id: -1784806000000
    });
    expect(result.id).toBe(-1784806000000);
  });
});
