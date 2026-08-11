const installInMemoryDexie = () => {
  class InMemoryTable {
    private rows = new Map<string | number, any>();
    private nextId = 1;

    constructor(private readonly schema: string) {}

    private get keyPath(): string {
      return this.schema.split(',')[0].replace(/^\+\+/, '').trim();
    }

    async toArray() {
      return Array.from(this.rows.values());
    }

    async get(key: string | number) {
      return this.rows.get(key);
    }

    async put(value: any) {
      const key = value[this.keyPath];
      this.rows.set(key, { ...value });
      return key;
    }

    async add(value: any) {
      const key = this.schema.startsWith('++')
        ? (value[this.keyPath] ?? this.nextId++)
        : value[this.keyPath];
      value[this.keyPath] = key;
      this.rows.set(key, { ...value });
      return key;
    }

    async update(key: string | number, changes: any) {
      const current = this.rows.get(key);
      if (!current) return 0;
      this.rows.set(key, { ...current, ...changes });
      return 1;
    }

    async delete(key: string | number) {
      this.rows.delete(key);
    }

    async bulkDelete(keys: Array<string | number>) {
      keys.forEach(key => this.rows.delete(key));
    }

    where(field: string) {
      return {
        equals: (value: unknown) => ({
          toArray: async () => (
            Array.from(this.rows.values()).filter(row => row[field] === value)
          )
        })
      };
    }
  }

  class InMemoryDexie {
    version() {
      return {
        stores: (schemas: Record<string, string>) => {
          for (const [name, schema] of Object.entries(schemas)) {
            if (!(this as any)[name]) {
              (this as any)[name] = new InMemoryTable(schema);
            }
          }

          return { upgrade: () => undefined };
        }
      };
    }

    async transaction(_mode: string, ...args: any[]) {
      const callback = args.at(-1);
      return await callback();
    }
  }

  vi.doMock('dexie', () => ({ default: InMemoryDexie }));
};

describe('offlineDb agendamentos', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    installInMemoryDexie();
  });

  afterEach(() => {
    vi.doUnmock('dexie');
  });

  it('reutiliza o registro temporario, mescla o snapshot e mantem uma unica criacao na fila', async () => {
    const { offlineDb, saveAgendamentoLocal } = await import('./offlineDb');
    const base = {
      clienteId: 12,
      clienteNome: 'Cliente Offline',
      start: '2026-08-07T09:00:00.000Z',
      end: '2026-08-07T10:00:00.000Z'
    };

    const first = await saveAgendamentoLocal({
      ...base,
      notes: 'Observacao que deve ser preservada'
    });

    // Simula uma fila legada duplicada antes da nova gravacao.
    await offlineDb.syncQueue.add({
      table: 'agendamentos',
      action: 'update',
      data: { ...first },
      timestamp: first._lastModified + 1,
      status: 'pending',
      retryCount: 0
    });

    const updated = await saveAgendamentoLocal({
      ...base,
      id: first.id,
      receiptDescription: 'Aplicacao de pelicula Carbono na sala'
    });

    const stored = await offlineDb.agendamentos.toArray();
    const queued = await offlineDb.syncQueue.toArray();

    expect(updated._localId).toBe(first._localId);
    expect(updated).toMatchObject({
      id: first.id,
      notes: 'Observacao que deve ser preservada',
      receiptDescription: 'Aplicacao de pelicula Carbono na sala',
      _syncStatus: 'pending'
    });
    expect(stored).toHaveLength(1);
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      action: 'create',
      data: expect.objectContaining({
        _localId: first._localId,
        receiptDescription: 'Aplicacao de pelicula Carbono na sala'
      }),
      status: 'pending',
      retryCount: 0
    });
  });

  it('reutiliza o cache remoto e consolida atualizacoes repetidas em uma unica fila', async () => {
    const { offlineDb, saveAgendamentoLocal } = await import('./offlineDb');
    const cached = {
      id: 42,
      clienteId: 12,
      clienteNome: 'Cliente Online',
      start: '2026-08-07T09:00:00.000Z',
      end: '2026-08-07T10:00:00.000Z',
      _localId: 'remote_agendamento_42',
      _syncStatus: 'synced' as const,
      _lastModified: 10,
      _syncedAt: 10,
      _remoteId: 42
    };
    await offlineDb.agendamentos.put(cached);

    await saveAgendamentoLocal({
      ...cached,
      receiptDescription: 'Primeiro snapshot'
    });
    const updated = await saveAgendamentoLocal({
      ...cached,
      receiptDescription: 'Snapshot final'
    });

    const stored = await offlineDb.agendamentos.toArray();
    const queued = await offlineDb.syncQueue.toArray();

    expect(updated._localId).toBe('remote_agendamento_42');
    expect(stored).toHaveLength(1);
    expect(stored[0].receiptDescription).toBe('Snapshot final');
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      action: 'update',
      data: expect.objectContaining({
        id: 42,
        _remoteId: 42,
        receiptDescription: 'Snapshot final'
      })
    });
  });
});
