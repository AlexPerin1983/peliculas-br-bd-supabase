class MemoryTable {
  rows = new Map<string | number, any>();
  private nextId = 1;
  constructor(private readonly schema: string) {}
  private get keyPath() { return this.schema.split(',')[0].replace(/^\+\+/, '').trim(); }
  async add(value: any) {
    const key = this.schema.startsWith('++') ? (value[this.keyPath] ?? this.nextId++) : value[this.keyPath];
    value[this.keyPath] = key;
    this.rows.set(key, { ...value });
    return key;
  }
  async put(value: any) { this.rows.set(value[this.keyPath], { ...value }); }
  async get(key: string | number) { return this.rows.get(key); }
  async delete(key: string | number) { this.rows.delete(key); }
  async update(key: string | number, changes: any) {
    this.rows.set(key, { ...this.rows.get(key), ...changes });
    return 1;
  }
  where(field: string) {
    return {
      equals: (expected: unknown) => ({
        toArray: async () => [...this.rows.values()].filter(row => row[field] === expected)
      })
    };
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

const measurement = (id: number, largura: string) => ({ id, largura, altura: '1', quantidade: 1 });
const option = (measurements: any[]): any => ({
  id: 10,
  name: 'Opcao',
  measurements,
  generalDiscount: { value: '', type: 'fixed' }
});

describe('alteracao nova na fila depois de um envio aceito', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('dexie', () => ({ default: MemoryDexie }));
  });
  afterEach(() => vi.doUnmock('dexie'));

  const prepare = async (queuedOptions: any[], sentOptions: any[]) => {
    const module = await import('./offlineDb');
    const queueItemId = await module.offlineDb.syncQueue.add({
      table: 'proposalOptions',
      action: 'update',
      data: { clientId: 15, options: queuedOptions, baseRevision: 7, baseOptions: [], syncToken: 'novo' },
      timestamp: 200,
      status: 'pending',
      retryCount: 0
    } as any);
    return { module, queueItemId: queueItemId as number, sentOptions };
  };

  it('passa a partir da revisao aceita e envia so a diferenca', async () => {
    const sent = [option([measurement(1, '2')])];
    const { module, queueItemId } = await prepare([option([measurement(1, '3')])], sent);

    await module.rebaseProposalOptionsSyncItem(queueItemId, 15, sent, sent, 8);

    const queued = await module.offlineDb.syncQueue.get(queueItemId);
    expect(queued?.data.baseRevision).toBe(8);
    expect(queued?.data.baseOptions).toEqual(sent);
    expect(queued?.data.options[0].measurements).toEqual([measurement(1, '3')]);
    expect(queued?.data.operations).toEqual([
      { type: 'upsert_measurement', optionId: 10, measurement: measurement(1, '3') }
    ]);
    expect((await module.getProposalSyncMeta(15))?.revision).toBe(8);
  });

  it('mantem a medida do outro aparelho sem pedir para apaga-la', async () => {
    const sent = [option([measurement(1, '2')])];
    const confirmed = [option([measurement(1, '2'), measurement(2, '5')])];
    const { module, queueItemId } = await prepare([option([measurement(1, '3')])], sent);

    await module.rebaseProposalOptionsSyncItem(queueItemId, 15, sent, confirmed, 9);

    const queued = await module.offlineDb.syncQueue.get(queueItemId);
    expect(queued?.data.options[0].measurements.map((item: any) => item.id)).toEqual([1, 2]);
    expect(queued?.data.operations.some((operation: any) => operation.type === 'delete_measurement')).toBe(false);

    const local = await module.getProposalOptionsLocal(15);
    expect(local[0].measurements.map(item => item.id)).toEqual([1, 2]);
    expect(local[0]._syncStatus).toBe('pending');
  });
});
