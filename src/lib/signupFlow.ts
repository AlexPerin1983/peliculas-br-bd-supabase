const SIGNUP_IN_PROGRESS_KEY = 'peliculas-br-signup-in-progress';

export function markSignupInProgress() {
    try {
        sessionStorage.setItem(SIGNUP_IN_PROGRESS_KEY, '1');
    } catch {
        // O fluxo continua mesmo quando o armazenamento da aba não está disponível.
    }
}

export function clearSignupInProgress() {
    try {
        sessionStorage.removeItem(SIGNUP_IN_PROGRESS_KEY);
    } catch {
        // Sem ação necessária.
    }
}

export function isSignupInProgress() {
    try {
        return sessionStorage.getItem(SIGNUP_IN_PROGRESS_KEY) === '1';
    } catch {
        return false;
    }
}
