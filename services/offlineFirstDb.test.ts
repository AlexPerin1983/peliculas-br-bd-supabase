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

  it('atualiza o indicador assim que salva um rascunho de medidas offline', async () => {
    const saveProposalOptionsLocalMock = vi.fn().mockResolvedValue(undefined);
    const refreshSyncStatusMock = vi.fn().mockResolvedValue(undefined);
    const syncAllPendingMock = vi.fn();
    const options = [{
      id: 10,
      name: 'Opcao Local',
      measurements: [],
      generalDiscount: { value: '', type: 'fixed' as const }
    }];

    vi.doMock('./offlineDb', () => ({
      saveProposalOptionsLocal: saveProposalOptionsLocalMock
    }));
    vi.doMock('./supabaseDb', () => ({}));
    vi.doMock('./syncService', () => ({
      isOnlineNow: vi.fn().mockReturnValue(false),
      refreshSyncStatus: refreshSyncStatusMock,
      syncAllPending: syncAllPendingMock
    }));

    const { saveProposalOptions } = await import('./offlineFirstDb');
    await saveProposalOptions(123, options);

    expect(saveProposalOptionsLocalMock).toHaveBeenCalledWith(123, options);
    expect(refreshSyncStatusMock).toHaveBeenCalledTimes(1);
    expect(syncAllPendingMock).not.toHaveBeenCalled();
    expect(saveProposalOptionsLocalMock.mock.invocationCallOrder[0])
      .toBeLessThan(refreshSyncStatusMock.mock.invocationCallOrder[0]);
  });

  it('restaura uma versao como nova revisao e atualiza o cache confirmado', async () => {
    const targetOptions = [{
      id: 10,
      name: 'Versao recuperada',
      measurements: [{
        id: 1,
        largura: '1,20',
        altura: '0,80',
        quantidade: 2,
        ambiente: 'Sala',
        tipoAplicacao: 'Interna',
        pelicula: 'Blackout',
        active: true
      }],
      generalDiscount: { value: '', type: 'fixed' as const }
    }];
    const currentOptions = [{
      id: 10,
      name: 'Versao atual',
      measurements: [],
      generalDiscount: { value: '', type: 'fixed' as const }
    }];
    const replaceCacheMock = vi.fn().mockResolvedValue(undefined);
    const saveRemoteMock = vi.fn().mockResolvedValue({
      options: targetOptions,
      revision: 8,
      conflictResolved: false,
      preservedConflicts: 0
    });
    const toArrayMock = vi.fn().mockResolvedValue([]);
    const equalsMock = vi.fn().mockReturnValue({ toArray: toArrayMock });
    const whereMock = vi.fn().mockReturnValue({ equals: equalsMock });
    const syncAllPendingMock = vi.fn().mockResolvedValue(undefined);
    const refreshSyncStatusMock = vi.fn().mockResolvedValue(undefined);

    vi.doMock('./offlineDb', () => ({
      getProposalOptionsLocal: vi.fn().mockResolvedValue([]),
      getSyncDeviceId: vi.fn().mockReturnValue('device-a'),
      replaceProposalOptionsCache: replaceCacheMock,
      offlineDb: {
        syncQueue: { where: whereMock }
      }
    }));
    vi.doMock('./supabaseDb', () => ({
      getProposalOptionsSnapshot: vi.fn().mockResolvedValue({ options: currentOptions, revision: 7 }),
      saveProposalOptionsRemote: saveRemoteMock
    }));
    vi.doMock('./syncService', () => ({
      isOnlineNow: vi.fn().mockReturnValue(true),
      syncAllPending: syncAllPendingMock,
      refreshSyncStatus: refreshSyncStatusMock
    }));

    const { restoreProposalOptionsVersion } = await import('./offlineFirstDb');
    const result = await restoreProposalOptionsVersion(123, targetOptions);

    expect(syncAllPendingMock).toHaveBeenCalledWith({ force: true });
    expect(saveRemoteMock).toHaveBeenCalledWith(123, targetOptions, {
      baseRevision: 7,
      baseOptions: currentOptions,
      deviceId: 'device-a'
    });
    expect(replaceCacheMock).toHaveBeenCalledWith(123, targetOptions, 'synced', 8);
    expect(refreshSyncStatusMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual(targetOptions);
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

  it('nao rele todo o IndexedDB em paginas remotas posteriores de PDFs', async () => {
    const getAllPdfsLocalMock = vi.fn();
    const remotePage = {
      pdfs: [],
      hasMore: false,
      nextOffset: 100
    };

    vi.doMock('./offlineDb', () => ({
      getAllPdfsLocal: getAllPdfsLocalMock
    }));

    vi.doMock('./supabaseDb', () => ({
      getPDFPage: vi.fn().mockResolvedValue(remotePage)
    }));

    vi.doMock('./syncService', () => ({
      isOnlineNow: vi.fn().mockReturnValue(true),
      syncAllPending: vi.fn()
    }));

    const { getPDFPage } = await import('./offlineFirstDb');
    const result = await getPDFPage({ offset: 100, limit: 50 });

    expect(result).toEqual(remotePage);
    expect(getAllPdfsLocalMock).not.toHaveBeenCalled();
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

  it('mantem o snapshot local mais recente do agendamento e nao duplica o remoto', async () => {
    const bulkPutMock = vi.fn().mockResolvedValue(undefined);
    const syncAllPendingMock = vi.fn().mockResolvedValue(undefined);
    const base = {
      clienteId: 12,
      clienteNome: 'Cliente Agenda',
      start: '2026-08-07T09:00:00.000Z',
      end: '2026-08-07T10:00:00.000Z'
    };
    const localAgendamentos = [
      {
        ...base,
        id: 42,
        receiptDescription: 'Descricao local antiga',
        _localId: 'remote_agendamento_42',
        _syncStatus: 'pending' as const,
        _lastModified: 100,
        _remoteId: 42
      },
      {
        ...base,
        id: 42,
        receiptDescription: 'Aplicacao de pelicula Carbono na sala',
        _localId: 'local_200_agendamento',
        _syncStatus: 'pending' as const,
        _lastModified: 200,
        _remoteId: 42
      },
      {
        ...base,
        id: 84,
        receiptDescription: 'Cache anterior',
        _localId: 'remote_agendamento_84',
        _syncStatus: 'synced' as const,
        _lastModified: 50,
        _remoteId: 84
      },
      {
        ...base,
        id: -300,
        clienteNome: 'Cliente criado offline',
        receiptDescription: 'Servico avulso',
        _localId: 'local_300_agendamento',
        _syncStatus: 'pending' as const,
        _lastModified: 300
      }
    ];
    const remoteAgendamentos = [
      { ...base, id: 42, receiptDescription: 'Descricao remota atrasada' },
      { ...base, id: 42, receiptDescription: 'Duplicata remota' },
      { ...base, id: 84, receiptDescription: 'Descricao remota atual' }
    ];

    vi.doMock('./offlineDb', () => ({
      getAllAgendamentosLocal: vi.fn().mockResolvedValue(localAgendamentos),
      offlineDb: {
        agendamentos: {
          bulkPut: bulkPutMock
        }
      }
    }));

    vi.doMock('./supabaseDb', () => ({
      getAllAgendamentos: vi.fn().mockResolvedValue(remoteAgendamentos)
    }));

    vi.doMock('./syncService', () => ({
      isOnlineNow: vi.fn().mockReturnValue(true),
      syncAllPending: syncAllPendingMock
    }));

    const { getAllAgendamentos } = await import('./offlineFirstDb');
    const result = await getAllAgendamentos();

    expect(result).toHaveLength(3);
    expect(result.find(item => item.id === 42)?.receiptDescription)
      .toBe('Aplicacao de pelicula Carbono na sala');
    expect(result.find(item => item.id === 84)?.receiptDescription)
      .toBe('Descricao remota atual');
    expect(result.find(item => item.id === -300)?.receiptDescription)
      .toBe('Servico avulso');
    expect(syncAllPendingMock).toHaveBeenCalledTimes(1);
    expect(bulkPutMock).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 84,
        _localId: 'remote_agendamento_84',
        _remoteId: 84,
        _syncStatus: 'synced',
        receiptDescription: 'Descricao remota atual'
      })
    ]);
  });

  it('faz uma leitura offline unica por agendamento e preserva a versao mais recente', async () => {
    const getAllAgendamentosLocalMock = vi.fn().mockResolvedValue([
      {
        id: -500,
        clienteId: 12,
        clienteNome: 'Cliente Offline',
        start: '2026-08-07T09:00:00.000Z',
        end: '2026-08-07T10:00:00.000Z',
        receiptDescription: 'Snapshot antigo',
        _localId: 'local_500_original',
        _syncStatus: 'pending' as const,
        _lastModified: 100
      },
      {
        id: -500,
        clienteId: 12,
        clienteNome: 'Cliente Offline',
        start: '2026-08-07T09:00:00.000Z',
        end: '2026-08-07T10:00:00.000Z',
        receiptDescription: 'Snapshot confirmado offline',
        _localId: 'local_600_duplicado',
        _syncStatus: 'pending' as const,
        _lastModified: 200
      }
    ]);

    vi.doMock('./offlineDb', () => ({
      getAllAgendamentosLocal: getAllAgendamentosLocalMock
    }));

    vi.doMock('./supabaseDb', () => ({
      getAllAgendamentos: vi.fn()
    }));

    vi.doMock('./syncService', () => ({
      isOnlineNow: vi.fn().mockReturnValue(false),
      syncAllPending: vi.fn()
    }));

    const { getAllAgendamentos } = await import('./offlineFirstDb');
    const result = await getAllAgendamentos();

    expect(getAllAgendamentosLocalMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      expect.objectContaining({
        id: -500,
        receiptDescription: 'Snapshot confirmado offline'
      })
    ]);
  });

  it('devolve a descricao consolidada pelo armazenamento local ao salvar offline', async () => {
    const saveAgendamentoLocalMock = vi.fn().mockResolvedValue({
      id: -700,
      clienteId: 12,
      clienteNome: 'Cliente Offline',
      start: '2026-08-07T09:00:00.000Z',
      end: '2026-08-07T10:00:00.000Z',
      notes: 'Observacao preservada',
      receiptDescription: 'Aplicacao de pelicula Jateada',
      _localId: 'local_700_agendamento',
      _syncStatus: 'pending' as const,
      _lastModified: 700
    });

    vi.doMock('./offlineDb', () => ({
      saveAgendamentoLocal: saveAgendamentoLocalMock,
      offlineDb: {
        agendamentos: {
          update: vi.fn()
        }
      }
    }));

    vi.doMock('./supabaseDb', () => ({
      saveAgendamento: vi.fn()
    }));

    vi.doMock('./syncService', () => ({
      isOnlineNow: vi.fn().mockReturnValue(false),
      syncAllPending: vi.fn()
    }));

    const { saveAgendamento } = await import('./offlineFirstDb');
    const result = await saveAgendamento({
      id: -700,
      clienteId: 12,
      clienteNome: 'Cliente Offline',
      start: '2026-08-07T09:00:00.000Z',
      end: '2026-08-07T10:00:00.000Z',
      receiptDescription: 'Aplicacao de pelicula Jateada'
    });

    expect(result).toMatchObject({
      id: -700,
      notes: 'Observacao preservada',
      receiptDescription: 'Aplicacao de pelicula Jateada'
    });
    expect(result).not.toHaveProperty('_syncStatus');
  });

  it('remove o PDF remoto e a copia local quando esta online', async () => {
    const deletePdfLocalMock = vi.fn().mockResolvedValue(undefined);
    const deletePdfRemoteMock = vi.fn().mockResolvedValue(undefined);

    vi.doMock('./offlineDb', () => ({
      deletePdfLocal: deletePdfLocalMock
    }));

    vi.doMock('./supabaseDb', () => ({
      deletePDF: deletePdfRemoteMock
    }));

    vi.doMock('./syncService', () => ({
      isOnlineNow: vi.fn().mockReturnValue(true),
      syncAllPending: vi.fn()
    }));

    const { deletePDF } = await import('./offlineFirstDb');
    await deletePDF(42);

    expect(deletePdfRemoteMock).toHaveBeenCalledWith(42);
    expect(deletePdfLocalMock).toHaveBeenCalledWith(42, { queueRemoteDelete: false });
  });

  it('remove o PDF local e deixa a exclusao na fila quando esta offline', async () => {
    const deletePdfLocalMock = vi.fn().mockResolvedValue(undefined);
    const deletePdfRemoteMock = vi.fn();

    vi.doMock('./offlineDb', () => ({
      deletePdfLocal: deletePdfLocalMock
    }));

    vi.doMock('./supabaseDb', () => ({
      deletePDF: deletePdfRemoteMock
    }));

    vi.doMock('./syncService', () => ({
      isOnlineNow: vi.fn().mockReturnValue(false),
      syncAllPending: vi.fn()
    }));

    const { deletePDF } = await import('./offlineFirstDb');
    await deletePDF(42);

    expect(deletePdfLocalMock).toHaveBeenCalledWith(42);
    expect(deletePdfRemoteMock).not.toHaveBeenCalled();
  });
});
