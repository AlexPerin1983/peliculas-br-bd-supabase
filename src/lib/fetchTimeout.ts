// Em internet móvel fraca, um pedido pode ficar pendurado para sempre (o navegador
// não tem prazo próprio). Sem prazo, a fila de envio fica presa nesse pedido e nada
// mais sobe até o app ser fechado. Aqui cada pedido ganha um limite de tempo.

const DEFAULT_TIMEOUT_MS = 45_000;
// Envio de arquivo (PDF, foto) precisa de mais tempo no 3G.
const STORAGE_TIMEOUT_MS = 120_000;

/** Prazo do pedido em milissegundos; null = sem prazo. */
export const pickRequestTimeoutMs = (url: string): number | null => {
    // Funções com IA podem demorar bastante: continuam sem prazo.
    if (url.includes('/functions/v1/')) return null;
    if (url.includes('/storage/v1/')) return STORAGE_TIMEOUT_MS;
    return DEFAULT_TIMEOUT_MS;
};

const readUrl = (input: RequestInfo | URL): string => {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    return input.url;
};

export const createFetchWithTimeout = (
    baseFetch: typeof fetch = (input, init) => fetch(input, init),
    pickTimeout: (url: string) => number | null = pickRequestTimeoutMs,
): typeof fetch => async (input, init) => {
    const timeoutMs = pickTimeout(readUrl(input));
    if (timeoutMs === null) return baseFetch(input, init);

    const controller = new AbortController();
    const outerSignal = init?.signal;
    const forwardAbort = () => controller.abort(outerSignal?.reason);
    if (outerSignal?.aborted) forwardAbort();
    else outerSignal?.addEventListener('abort', forwardAbort, { once: true });

    const timer = setTimeout(() => {
        controller.abort(new Error('Tempo esgotado: request timed out'));
    }, timeoutMs);

    try {
        return await baseFetch(input, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timer);
        outerSignal?.removeEventListener('abort', forwardAbort);
    }
};
