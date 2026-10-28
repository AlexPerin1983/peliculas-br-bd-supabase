// Leitura do servidor com prazo: com internet fraca, a tela não fica esperando
// o Supabase quando o aparelho já tem uma cópia dos dados para mostrar.

export const REMOTE_READ_DEADLINE_MS = 2500;

export class RemoteReadTimeoutError extends Error {
    constructor(label: string) {
        super(`Servidor demorou para responder (${label}); usando dados do aparelho`);
        this.name = 'RemoteReadTimeoutError';
    }
}

export const isRemoteReadTimeout = (error: unknown): error is RemoteReadTimeoutError => (
    error instanceof RemoteReadTimeoutError
);

const DEADLINE_REACHED = Symbol('deadline');

/**
 * Espera a resposta do servidor por até `deadlineMs`. Passado o prazo:
 * - se o aparelho tem dados, rejeita com RemoteReadTimeoutError (quem chama usa o cache);
 * - se não tem (primeiro uso), continua esperando o servidor.
 * A resposta atrasada é descartada, para não sobrescrever o cache no meio de uma edição.
 */
export async function withRemoteDeadline<T>(
    request: Promise<T>,
    hasLocalData: () => Promise<boolean>,
    label: string,
    deadlineMs: number = REMOTE_READ_DEADLINE_MS
): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<typeof DEADLINE_REACHED>(resolve => {
        timer = setTimeout(() => resolve(DEADLINE_REACHED), deadlineMs);
    });

    try {
        const first = await Promise.race([request, deadline]);
        if (first !== DEADLINE_REACHED) return first as T;
    } finally {
        clearTimeout(timer);
    }

    if (!await hasLocalData()) return request;

    request.catch(() => undefined);
    throw new RemoteReadTimeoutError(label);
}
