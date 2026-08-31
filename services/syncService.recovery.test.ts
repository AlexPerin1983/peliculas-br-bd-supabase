const remoteDefaults = (saveClientRemote: ReturnType<typeof vi.fn>) => ({
  saveClientRemote,
  deleteClientRemote: vi.fn(),
  saveCustomFilmRemote: vi.fn(),
  deleteCustomFilmRemote: vi.fn(),
  saveUserInfoRemote: vi.fn(),
  saveProposalOptionsRemote: vi.fn(),
  savePDFRemote: vi.fn(),
  deletePDFRemote: vi.fn(),
  saveAgendamentoRemote: vi.fn(),
  deleteAgendamentoRemote: vi.fn(),
  saveStandaloneExpenseRemote: vi.fn(),
  deleteStandaloneExpenseRemote: vi.fn()
});

const queueItem = (changes: Record<string, unknown> = {}) => ({
  id: 31,
  table: 'clients',
  action: 'update',
  data: { _localId: 'local_31', _remoteId: 31, nome: 'Cliente protegido' },
  timestamp: 1_700_000_000_000,
  status: 'error',
  retryCount: 4,
  ...changes
});

describe('syncService recovery policy', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  function install(item: any, saveClientRemote: ReturnType<typeof vi.fn>, counts = { pending: 0, failed: 1 }) {
    const remove = vi.fn();
    const markError = vi.fn().mockResolvedValue(true);
    const markPending = vi.fn();
    vi.doMock('./offlineDb', () => ({
      offlineDb: {
        syncQueue: {
          orderBy: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([item]) })),
          delete: remove
        }
      },
      getFailedSyncItems: vi.fn().mockResolvedValue(item.status === 'error' ? [item] : []),
      getFailedSyncCount: vi.fn().mockResolvedValue(counts.failed),
      getPendingSyncCount: vi.fn().mockResolvedValue(counts.pending),
      markSyncItemError: markError,
      markSyncItemPending: markPending,
      markAsSynced: vi.fn(),
      markProposalOptionsAsSynced: vi.fn()
    }));
    vi.doMock('./supabaseDb', () => remoteDefaults(saveClientRemote));
    return { remove, markError, markPending };
  }

  it('pausa erro de permissao automaticamente, mas permite tentativa manual sem apagar a fila', async () => {
    const item = queueItem({
      lastError: 'permission denied by row-level security',
      errorInfo: { category: 'permission', code: '42501' }
    });
    const save = vi.fn().mockResolvedValue({ id: 31 });
    const mocks = install(item, save);
    const { syncAllPending, forcSync } = await import('./syncService');

    await syncAllPending();
    expect(save).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.markPending).not.toHaveBeenCalled();

    await forcSync();
    expect(save).toHaveBeenCalledTimes(1);
    expect(mocks.remove).toHaveBeenCalledWith(31);
  });

  it('agenda nova tentativa para rede e nao registra envio completo', async () => {
    const item = queueItem({ status: 'pending', retryCount: 0, lastError: undefined });
    const save = vi.fn().mockRejectedValue(new Error('Failed to fetch'));
    const mocks = install(item, save, { pending: 0, failed: 1 });
    const { syncAllPending, getSyncStatus } = await import('./syncService');

    await syncAllPending();
    const status = getSyncStatus();
    expect(status.lastSyncAt).toBeNull();
    expect(status.lastAttemptAt).not.toBeNull();
    expect(status.nextRetryAt).toBeGreaterThan(status.lastAttemptAt || 0);
    expect(mocks.markError).toHaveBeenCalledWith(
      31,
      expect.any(String),
      { category: 'network', code: 'SYNC_NETWORK' },
      { timestamp: item.timestamp, syncToken: undefined }
    );
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it('registra envio completo somente depois da confirmacao e da fila vazia', async () => {
    const item = queueItem({ status: 'pending', retryCount: 0 });
    const save = vi.fn().mockResolvedValue({ id: 31 });
    install(item, save, { pending: 0, failed: 0 });
    const { syncAllPending, getSyncStatus } = await import('./syncService');

    await syncAllPending();
    expect(getSyncStatus().lastSyncAt).not.toBeNull();
  });
});
