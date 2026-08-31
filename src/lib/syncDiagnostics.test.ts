import { buildSyncDiagnostic } from './syncDiagnostics';
import type { SyncStatus } from '../../services/syncService';

describe('buildSyncDiagnostic', () => {
  it('inclui somente metadados seguros e nunca dados de negocio', () => {
    const secretFragments = [
      'Maria Segredo', 'maria@segredo.test', '85999999999', 'R$ 7.321,45',
      '1,52 x 2,80', 'eyJhbGciOiJIUzI1NiJ9.token'
    ];
    const unsafe = secretFragments.join(' | ');
    const status: SyncStatus = {
      isOnline: true,
      pendingCount: 2,
      failedCount: 1,
      failedItems: [{
        id: 987654,
        table: unsafe,
        action: 'update',
        retryCount: 3,
        lastError: unsafe,
        lastAttemptAt: 1_700_000_000_000,
        errorInfo: { category: 'permission', code: unsafe }
      }],
      lastSyncAt: null,
      lastAttemptAt: 1_700_000_000_000,
      nextRetryAt: null,
      syncInProgress: false,
      error: unsafe,
      errorInfo: { category: 'unknown', code: unsafe }
    };

    const diagnostic = buildSyncDiagnostic(status, 1_700_000_001_000);
    secretFragments.forEach(fragment => expect(diagnostic).not.toContain(fragment));
    expect(diagnostic).not.toContain('987654');
    expect(JSON.parse(diagnostic)).toMatchObject({
      diagnostic: 'peliculasbr-sync-v1',
      waiting: 2,
      failed: 1,
      currentError: { category: 'unknown', code: 'SYNC_UNKNOWN' },
      failures: [{ area: 'unknown', category: 'permission', code: 'SYNC_PERMISSION' }]
    });
  });
});
