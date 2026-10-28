import { describe, expect, it } from 'vitest';
import { shouldKeepSessionWhileOffline } from './offlineSession';

describe('login mantido sem internet', () => {
    it('mantém a conta quando a renovação falha mas o login continua guardado', () => {
        expect(shouldKeepSessionWhileOffline({
            event: 'INITIAL_SESSION',
            incomingSession: null,
            hasPersistedSession: true
        })).toBe(true);
        expect(shouldKeepSessionWhileOffline({ incomingSession: null, hasPersistedSession: true })).toBe(true);
    });

    it('sai da conta quando o usuário saiu de verdade', () => {
        expect(shouldKeepSessionWhileOffline({
            event: 'SIGNED_OUT',
            incomingSession: null,
            hasPersistedSession: true
        })).toBe(false);
    });

    it('sai da conta quando o login guardado foi apagado', () => {
        expect(shouldKeepSessionWhileOffline({
            event: 'INITIAL_SESSION',
            incomingSession: null,
            hasPersistedSession: false
        })).toBe(false);
    });

    it('não interfere quando há sessão nova', () => {
        expect(shouldKeepSessionWhileOffline({
            event: 'TOKEN_REFRESHED',
            incomingSession: { access_token: 'novo' },
            hasPersistedSession: true
        })).toBe(false);
    });
});
