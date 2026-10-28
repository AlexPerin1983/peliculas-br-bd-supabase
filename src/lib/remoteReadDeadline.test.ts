import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isRemoteReadTimeout, withRemoteDeadline } from './remoteReadDeadline';

const never = <T>() => new Promise<T>(() => {});

describe('leitura do servidor com prazo', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('devolve a resposta do servidor quando ela chega no prazo', async () => {
        const hasLocalData = vi.fn(async () => true);
        await expect(withRemoteDeadline(Promise.resolve(['servidor']), hasLocalData, 'teste', 2500))
            .resolves.toEqual(['servidor']);
        expect(hasLocalData).not.toHaveBeenCalled();
    });

    it('desiste do servidor lento quando o aparelho tem dados', async () => {
        const result = withRemoteDeadline(never<string[]>(), async () => true, 'clientes', 2500)
            .catch(error => error);

        await vi.advanceTimersByTimeAsync(2500);
        const error = await result;
        expect(isRemoteReadTimeout(error)).toBe(true);
        expect(String(error.message)).toContain('clientes');
    });

    it('continua esperando o servidor quando o aparelho ainda está vazio', async () => {
        let resolveRemote: (value: string[]) => void = () => {};
        const remote = new Promise<string[]>(resolve => { resolveRemote = resolve; });
        let settled = false;
        const result = withRemoteDeadline(remote, async () => false, 'clientes', 2500)
            .then(value => { settled = true; return value; });

        await vi.advanceTimersByTimeAsync(10_000);
        expect(settled).toBe(false);

        resolveRemote(['primeiro uso']);
        await expect(result).resolves.toEqual(['primeiro uso']);
    });

    it('repassa o erro do servidor que falha antes do prazo', async () => {
        await expect(withRemoteDeadline(Promise.reject(new Error('rede')), async () => true, 'teste', 2500))
            .rejects.toThrow('rede');
    });

    it('não deixa erro solto quando a resposta atrasada falha depois', async () => {
        let rejectRemote: (error: Error) => void = () => {};
        const remote = new Promise<string[]>((_, reject) => { rejectRemote = reject; });
        const unhandled = vi.fn();
        process.on('unhandledRejection', unhandled);

        const result = withRemoteDeadline(remote, async () => true, 'teste', 2500).catch(error => error);
        await vi.advanceTimersByTimeAsync(2500);
        expect(isRemoteReadTimeout(await result)).toBe(true);

        rejectRemote(new Error('caiu depois'));
        await vi.advanceTimersByTimeAsync(0);
        process.off('unhandledRejection', unhandled);
        expect(unhandled).not.toHaveBeenCalled();
    });
});
