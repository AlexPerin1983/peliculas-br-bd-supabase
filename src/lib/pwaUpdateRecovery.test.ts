import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const recoveryScript = [...readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
    .matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map(match => match[1])
    .find(script => script.includes('peliculas-br-asset-recovery-at'))!;

const makeHarness = ({ online = true, scope = 'https://app.filmstec.shop/' } = {}) => {
    const operations: string[] = [];
    const unregister = vi.fn(async () => { operations.push('unregister'); return true; });
    const registration = { scope, waiting: null, installing: null, update: vi.fn().mockResolvedValue(undefined), unregister };
    const getRegistration = vi.fn().mockResolvedValue(registration);
    const deleteCache = vi.fn(async (name: string) => { operations.push(`delete:${name}`); return true; });
    const replace = vi.fn((url: string) => operations.push(`navigate:${url}`));
    const fetch = vi.fn(async () => {
        operations.push('network');
        return { ok: true, headers: { get: () => 'text/html; charset=utf-8' } };
    });
    const deleteDatabase = vi.fn();
    const appWindow = {
        location: { href: 'https://app.filmstec.shop/?tab=orcamentos#carros', replace },
        sessionStorage: window.sessionStorage,
        localStorage: window.localStorage,
        caches: {
            keys: vi.fn().mockResolvedValue(['peliculas-br-bd-v2.7.5', 'app-cache-v1', 'unrelated-cache']),
            delete: deleteCache,
        },
        setTimeout,
        clearTimeout,
        addEventListener: vi.fn(),
        __isLocalDevHost: false,
        __recoverPeliculasApp: (_reason: string) => {},
    };
    window.localStorage.setItem('pending-offline-work-test', 'preserved');
    window.sessionStorage.setItem('peliculas-br-asset-recovery-at', String(Date.now()));
    runInNewContext(recoveryScript, {
        window: appWindow, document, navigator: { onLine: online, serviceWorker: { getRegistration } },
        fetch, URL, Promise, Date, console: { warn: vi.fn(), error: vi.fn() },
        indexedDB: { deleteDatabase },
    });
    appWindow.__recoverPeliculasApp('Failed to fetch dynamically imported module');
    const button = (document.getElementById('pwa-recovery-button')
        || document.getElementById('pwa-offline-button')) as HTMLButtonElement;
    expect(button).not.toBeNull();
    return { operations, unregister, registration, getRegistration, deleteCache, replace, fetch, deleteDatabase, button };
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
    document.getElementById('pwa-recovery-screen')?.remove();
    document.getElementById('pwa-offline-screen')?.remove();
    window.sessionStorage.clear();
    window.localStorage.removeItem('pending-offline-work-test');
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe('manual recovery after the automatic PWA refresh failed', () => {
    it('removes the stuck root worker before reopening the app and preserves offline work', async () => {
        const h = makeHarness();
        h.button.click();
        await vi.advanceTimersByTimeAsync(1);

        expect(h.unregister).toHaveBeenCalledOnce();
        expect(h.registration.update).not.toHaveBeenCalled();
        expect(h.deleteCache).toHaveBeenCalledWith('peliculas-br-bd-v2.7.5');
        expect(h.deleteCache).toHaveBeenCalledWith('app-cache-v1');
        expect(h.deleteCache).not.toHaveBeenCalledWith('unrelated-cache');
        expect(h.operations.indexOf('unregister')).toBeLessThan(h.operations.indexOf('delete:peliculas-br-bd-v2.7.5'));
        expect(h.replace).toHaveBeenCalledOnce();
        const fresh = new URL(h.replace.mock.calls[0][0]);
        expect(fresh.searchParams.get('tab')).toBe('orcamentos');
        expect(fresh.searchParams.has('_app_refresh')).toBe(true);
        expect(fresh.hash).toBe('#carros');
        expect(window.localStorage.getItem('pending-offline-work-test')).toBe('preserved');
        expect(h.deleteDatabase).not.toHaveBeenCalled();
    });

    it('offline, shows "Sem internet" instead of updating and keeps the installed files', async () => {
        const h = makeHarness({ online: false });
        expect(document.getElementById('pwa-recovery-screen')).toBeNull();
        expect(document.getElementById('pwa-offline-screen')?.textContent).toContain('Sem internet');

        h.button.click();
        await vi.advanceTimersByTimeAsync(1);

        expect(h.registration.update).not.toHaveBeenCalled();
        expect(h.unregister).not.toHaveBeenCalled();
        expect(h.deleteCache).not.toHaveBeenCalled();
        expect(h.replace).toHaveBeenCalledWith('/');
    });

    it('keeps the installed files when the new page cannot be reached', async () => {
        const h = makeHarness();
        h.fetch.mockRejectedValueOnce(new Error('network unavailable'));
        h.button.click();
        await vi.advanceTimersByTimeAsync(1);

        expect(h.unregister).not.toHaveBeenCalled();
        expect(h.deleteCache).not.toHaveBeenCalled();
        expect(h.replace).not.toHaveBeenCalled();
        expect(h.button.disabled).toBe(false);
        expect(h.button.textContent).toBe('Tentar novamente');
    });

    it('allows retry instead of leaving the button stuck when worker lookup never resolves', async () => {
        const h = makeHarness();
        h.getRegistration.mockReturnValueOnce(new Promise(() => {}));
        h.button.click();
        await vi.advanceTimersByTimeAsync(6_000);

        expect(h.button.disabled).toBe(false);
        expect(h.button.textContent).toBe('Tentar novamente');
        expect(h.deleteCache).not.toHaveBeenCalled();
        expect(h.replace).not.toHaveBeenCalled();
    });

    it('allows retry instead of reloading under a worker that could not be removed', async () => {
        const h = makeHarness();
        h.unregister.mockReturnValueOnce(new Promise(() => {}));
        h.button.click();
        await vi.advanceTimersByTimeAsync(6_000);

        expect(h.button.disabled).toBe(false);
        expect(h.deleteCache).not.toHaveBeenCalled();
        expect(h.replace).not.toHaveBeenCalled();
    });

    it('leaves workers from a different scope registered', async () => {
        const h = makeHarness({ scope: 'https://app.filmstec.shop/other-tool/' });
        h.button.click();
        await vi.advanceTimersByTimeAsync(1);

        expect(h.unregister).not.toHaveBeenCalled();
        expect(h.replace).toHaveBeenCalledOnce();
    });
});
