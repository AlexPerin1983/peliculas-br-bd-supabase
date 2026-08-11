export interface PasswordRecoveryTokens {
    accessToken: string;
    refreshToken: string;
}

export const readPasswordRecoveryTokens = (
    pathname: string,
    hash: string
): PasswordRecoveryTokens | null => {
    if (!pathname.startsWith('/reset-password')) {
        return null;
    }

    const params = new URLSearchParams(hash.replace(/^#/, ''));
    if (params.get('type') !== 'recovery') {
        return null;
    }

    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (!accessToken || !refreshToken) {
        return null;
    }

    return { accessToken, refreshToken };
};
