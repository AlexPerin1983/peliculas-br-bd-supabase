import type { SyncStatus } from '../../services/syncService';
import { getSyncErrorInfo, sanitizeSyncErrorInfo, classifySyncError, canAutomaticallyRetrySyncError } from './syncErrors';

const TABLES = new Set(['clients', 'films', 'savedPdfs', 'agendamentos', 'proposalOptions', 'userInfo', 'standaloneExpenses']);
const ACTIONS = new Set(['create', 'update', 'delete']);
const count = (value: number) => Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
const date = (value?: number | null) => value && Number.isFinite(value) && Math.abs(value) < 8.64e15 ? new Date(value).toISOString() : null;

export const buildSyncDiagnostic = (status: SyncStatus, now = Date.now()) => {
    const failures = status.failedItems.slice(0, 20).map(item => {
        const error = getSyncErrorInfo(item);
        return {
            area: TABLES.has(item.table) ? item.table : 'unknown',
            operation: ACTIONS.has(item.action) ? item.action : 'unknown',
            category: error.category,
            code: error.code,
            attempts: count(item.retryCount),
            lastAttemptAt: date(item.lastAttemptAt),
            automaticRetry: canAutomaticallyRetrySyncError(error, item.retryCount),
        };
    });
    return JSON.stringify({
        diagnostic: 'peliculasbr-sync-v1',
        generatedAt: date(now),
        networkAvailable: status.isOnline === true,
        syncing: status.syncInProgress === true,
        waiting: count(status.pendingCount),
        failed: count(status.failedCount),
        lastAttemptAt: date(status.lastAttemptAt),
        lastCompletedSyncAt: date(status.lastSyncAt),
        nextAutomaticAttemptAt: date(status.nextRetryAt),
        currentError: status.error ? sanitizeSyncErrorInfo(status.errorInfo) ?? classifySyncError(status.error) : null,
        includedFailures: failures.length,
        failures,
    }, null, 2);
};
