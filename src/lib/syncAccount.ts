import type { SyncErrorInfo } from './syncErrors';

// Deve ser igual ao storageKey configurado em services/supabaseClient.ts
const AUTH_SESSION_STORAGE_KEY = 'peliculas-br-bd-auth-v4';

interface AccountScopedQueueItem {
    ownerUserId?: string;
    lastAttemptUserId?: string;
    errorInfo?: SyncErrorInfo;
}

/**
 * Conta logada neste aparelho, lida da sessão guardada (funciona sem internet).
 * O banco local é um só para todas as contas, então cada alteração na fila
 * guarda de qual conta veio.
 */
export const readSyncAccountId = (): string | null => {
    try {
        const raw = globalThis.localStorage?.getItem(AUTH_SESSION_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const session = parsed?.currentSession ?? parsed?.session ?? parsed;
        const id = session?.user?.id;
        return typeof id === 'string' && id ? id : null;
    } catch {
        return null;
    }
};

/** Alteração feita em outra conta: espera essa conta entrar de novo. */
export const belongsToOtherAccount = (item: AccountScopedQueueItem, accountId: string | null): boolean =>
    Boolean(item.ownerUserId && accountId && item.ownerUserId !== accountId);

/**
 * Recusa de permissão pausa o envio. Se outra conta entrou desde a última
 * tentativa, vale tentar de novo: a alteração pode ser desta conta
 * (filas antigas não sabem de qual conta vieram).
 */
export const shouldRetryAfterAccountChange = (item: AccountScopedQueueItem, accountId: string | null): boolean =>
    Boolean(accountId)
    && item.errorInfo?.category === 'permission'
    && item.lastAttemptUserId !== accountId;
