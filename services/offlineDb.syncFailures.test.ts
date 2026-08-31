class MemoryTable {
  private rows = new Map<string | number, any>();
  private nextId = 1;
  constructor(private readonly schema: string) {}
  private get keyPath() { return this.schema.split(',')[0].replace(/^\+\+/, '').trim(); }
  async add(value: any) {
    const key = this.schema.startsWith('++') ? (value[this.keyPath] ?? this.nextId++) : value[this.keyPath];
    value[this.keyPath] = key;
    this.rows.set(key, { ...value });
    return key;
  }
  async get(key: string | number) { return this.rows.get(key); }
  async update(key: string | number, changes: any) {
    const value = this.rows.get(key);
    if (!value) return 0;
    this.rows.set(key, { ...value, ...changes });
    return 1;
  }
}

class MemoryDexie {
  version() {
    return {
      stores: (schemas: Record<string, string>) => {
        for (const [name, schema] of Object.entries(schemas)) {
          if (!(this as any)[name]) (this as any)[name] = new MemoryTable(schema);
        }
        return { upgrade: () => undefined };
      }
    };
  }
  async transaction(_mode: string, ...args: any[]) { return await args.at(-1)(); }
}

describe('offlineDb sync failure metadata', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('dexie', () => ({ default: MemoryDexie }));
  });
  afterEach(() => vi.doUnmock('dexie'));

  it('nao aplica o erro de uma tentativa antiga sobre uma edicao mais nova', async () => {
    const { offlineDb, markSyncItemError } = await import('./offlineDb');
    const id = await offlineDb.syncQueue.add({
      table: 'proposalOptions', action: 'update', data: { syncToken: 'nova-versao' },
      timestamp: 200, status: 'pending', retryCount: 0
    });

    const markedOld = await markSyncItemError(id, 'erro antigo',
      { category: 'network', code: 'SYNC_NETWORK' },
      { timestamp: 100, syncToken: 'versao-antiga' });

    expect(markedOld).toBe(false);
    expect(await offlineDb.syncQueue.get(id)).toMatchObject({
      status: 'pending', retryCount: 0, data: { syncToken: 'nova-versao' }
    });

    const markedCurrent = await markSyncItemError(id, 'falha de rede',
      { category: 'network', code: 'SYNC_NETWORK' },
      { timestamp: 200, syncToken: 'nova-versao' });

    expect(markedCurrent).toBe(true);
    expect(await offlineDb.syncQueue.get(id)).toMatchObject({
      status: 'error', retryCount: 1,
      errorInfo: { category: 'network', code: 'SYNC_NETWORK' }
    });
  });
});
