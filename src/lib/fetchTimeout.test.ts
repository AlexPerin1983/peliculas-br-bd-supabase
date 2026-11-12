import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFetchWithTimeout, pickRequestTimeoutMs } from './fetchTimeout';
import { classifySyncError } from './syncErrors';

const hangingFetch = () => vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
}));

describe('prazo dos pedidos ao servidor', () => {
    afterEach(() => vi.useRealTimers());

    it('dá mais tempo para envio de arquivo e nenhum prazo para funções com IA', () => {
        expect(pickRequestTimeoutMs('https://x.supabase.co/rest/v1/saved_pdfs')).toBe(45_000);
        expect(pickRequestTimeoutMs('https://x.supabase.co/storage/v1/object/pdfs/a.pdf')).toBe(120_000);
        expect(pickRequestTimeoutMs('https://x.supabase.co/functions/v1/gemini-proxy')).toBeNull();
    });

    it('cancela o pedido pendurado e o erro entra como falha temporária (tenta de novo)', async () => {
        vi.useFakeTimers();
        const base = hangingFetch();
        const request = createFetchWithTimeout(base as unknown as typeof fetch)('https://x.supabase.co/rest/v1/saved_pdfs');
        const outcome = request.catch(error => error);

        await vi.advanceTimersByTimeAsync(45_000);

        const error = await outcome;
        expect(error).toBeInstanceOf(Error);
        expect(classifySyncError(error).category).toBe('server');
    });

    it('não mexe no pedido que responde a tempo', async () => {
        const response = new Response('ok');
        const base = vi.fn(async () => response);
        const result = await createFetchWithTimeout(base as unknown as typeof fetch)('https://x.supabase.co/rest/v1/clients');
        expect(result).toBe(response);
    });

    it('respeita o cancelamento de quem fez o pedido', async () => {
        const base = hangingFetch();
        const outer = new AbortController();
        const request = createFetchWithTimeout(base as unknown as typeof fetch)('https://x.supabase.co/rest/v1/clients', { signal: outer.signal });
        const outcome = request.catch(error => error);
        outer.abort(new Error('cancelado por quem pediu'));
        expect((await outcome).message).toBe('cancelado por quem pediu');
    });
});
