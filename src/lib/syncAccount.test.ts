import { afterEach, describe, expect, it } from 'vitest';
import { belongsToOtherAccount, readSyncAccountId, shouldRetryAfterAccountChange } from './syncAccount';

const permission = { category: 'permission' as const, code: 'SYNC_PERMISSION' };

describe('syncAccount', () => {
    afterEach(() => localStorage.clear());

    it('lê a conta da sessão guardada', () => {
        expect(readSyncAccountId()).toBeNull();
        localStorage.setItem('peliculas-br-bd-auth-v4', JSON.stringify({ access_token: 't', user: { id: 'loja' } }));
        expect(readSyncAccountId()).toBe('loja');
        localStorage.setItem('peliculas-br-bd-auth-v4', '{quebrado');
        expect(readSyncAccountId()).toBeNull();
    });

    it('segura só as alterações de outra conta', () => {
        expect(belongsToOtherAccount({ ownerUserId: 'admin' }, 'loja')).toBe(true);
        expect(belongsToOtherAccount({ ownerUserId: 'loja' }, 'loja')).toBe(false);
        // Fila antiga, sem conta: continua sendo enviada.
        expect(belongsToOtherAccount({}, 'loja')).toBe(false);
        expect(belongsToOtherAccount({ ownerUserId: 'admin' }, null)).toBe(false);
    });

    it('tenta de novo a recusa de permissão quando outra conta entra', () => {
        expect(shouldRetryAfterAccountChange({ errorInfo: permission }, 'loja')).toBe(true);
        expect(shouldRetryAfterAccountChange({ errorInfo: permission, lastAttemptUserId: 'admin' }, 'loja')).toBe(true);
        expect(shouldRetryAfterAccountChange({ errorInfo: permission, lastAttemptUserId: 'loja' }, 'loja')).toBe(false);
        expect(shouldRetryAfterAccountChange({ errorInfo: { category: 'server', code: 'X' } as any }, 'loja')).toBe(false);
        expect(shouldRetryAfterAccountChange({ errorInfo: permission }, null)).toBe(false);
    });
});
