import { describe, expect, it } from 'vitest';
import { readPasswordRecoveryTokens } from './passwordRecovery';

describe('readPasswordRecoveryTokens', () => {
    it('reads an implicit recovery session from the reset-password hash', () => {
        expect(readPasswordRecoveryTokens(
            '/reset-password',
            '#access_token=access&refresh_token=refresh&type=recovery'
        )).toEqual({
            accessToken: 'access',
            refreshToken: 'refresh'
        });
    });

    it('ignores recovery tokens outside the reset-password page', () => {
        expect(readPasswordRecoveryTokens(
            '/',
            '#access_token=access&refresh_token=refresh&type=recovery'
        )).toBeNull();
    });

    it('rejects incomplete or non-recovery hashes', () => {
        expect(readPasswordRecoveryTokens(
            '/reset-password',
            '#access_token=access&type=recovery'
        )).toBeNull();
        expect(readPasswordRecoveryTokens(
            '/reset-password',
            '#access_token=access&refresh_token=refresh&type=signup'
        )).toBeNull();
    });
});
