const SIGNUP_PENDING_LOGIN_KEY = 'peliculas-br-signup-pending-login';

export function markSignupPendingLogin() {
    try {
        sessionStorage.setItem(SIGNUP_PENDING_LOGIN_KEY, '1');
    } catch {
        // O fluxo continua mesmo quando o armazenamento da aba não está disponível.
    }
}

export function clearSignupPendingLogin() {
    try {
        sessionStorage.removeItem(SIGNUP_PENDING_LOGIN_KEY);
    } catch {
        // Sem ação necessária.
    }
}

export function isSignupPendingLogin() {
    try {
        return sessionStorage.getItem(SIGNUP_PENDING_LOGIN_KEY) === '1';
    } catch {
        return false;
    }
}
