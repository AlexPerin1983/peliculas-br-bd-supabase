import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const readProjectFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const readRecoveryScript = () => {
    const html = readProjectFile('index.html');
    return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
        .map(match => match[1])
        .find(script => script.includes('peliculas-br-asset-recovery-at'));
};

afterEach(() => {
    document.getElementById('pwa-recovery-screen')?.remove();
    window.sessionStorage.clear();
    delete (window as typeof window & { __recoverPeliculasApp?: unknown }).__recoverPeliculasApp;
    delete (window as typeof window & { __isLocalDevHost?: unknown }).__isLocalDevHost;
    delete (window as typeof window & { __reloadPeliculasApp?: unknown }).__reloadPeliculasApp;
    delete (window as typeof window & { __peliculasReloading?: unknown }).__peliculasReloading;
    Reflect.deleteProperty(window, 'caches');
    Reflect.deleteProperty(navigator, 'serviceWorker');
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('PWA stale asset recovery', () => {
    it('renders one global update prompt before authentication', () => {
        const entry = readProjectFile('index.tsx');
        const app = readProjectFile('App.tsx');

        expect(entry).toContain("import UpdateBanner from './components/UpdateBanner'");
        expect(entry.match(/<UpdateBanner\s*\/>/g)).toHaveLength(1);
        expect(entry.indexOf('<UpdateBanner />')).toBeLessThan(entry.indexOf('<AuthProvider>'));
        expect(app).not.toContain('UpdateBanner');
        expect(app).not.toContain('UpdateNotification');
        expect(app).not.toContain('usePwaUpdate');
    });

    it('does not rewrite missing hashed assets to the SPA HTML', () => {
        const config = JSON.parse(readProjectFile('vercel.json'));
        const html = readProjectFile('index.html');
        const spaRewrite = config.rewrites.find((rewrite: { destination: string }) => (
            rewrite.destination === '/index.html'
        ));

        expect(spaRewrite?.source).toBe('/((?!assets/).*)');
        expect(html).toContain('interactive-widget=resizes-content');
    });

    it('mantem o conteudo do PWA iOS abaixo da barra de status', () => {
        const html = readProjectFile('index.html');

        expect(html).toMatch(
            /<meta\s+name="apple-mobile-web-app-status-bar-style"\s+content="black">/
        );
        expect(html).not.toContain('content="black-translucent"');
    });

    it('recovers stale module failures without clearing offline data', () => {
        const html = readProjectFile('index.html');

        expect(html).toContain("window.addEventListener('vite:preloadError'");
        expect(html).toContain("window.addEventListener('unhandledrejection'");
        expect(html).toContain("'app-cache-'");
        expect(html).toContain("'peliculas-brasil-'");
        expect(html).toContain("'workbox-'");
        expect(html).toContain('.filter(isTechnicalCacheName)');
        expect(html).toContain('withTimeout(cleanup, [])');
        expect(html).toContain('TECHNICAL_STEP_TIMEOUT_MS');
        expect(html).toContain('Seus dados e trabalhos offline serão preservados.');
        expect(html).not.toContain('indexedDB.deleteDatabase');
        expect(html).not.toContain('localStorage.clear');
    });

    it('activates a waiting worker from both update entry points', () => {
        const html = readProjectFile('index.html');
        const banner = readProjectFile('components/UpdateBanner.tsx');

        expect(html).toContain("waitingWorker.postMessage({ type: 'SKIP_WAITING' })");
        expect(html).toContain('prepareFreshVersion()');
        expect(banner).toContain("waitingWorker.postMessage({ type: 'SKIP_WAITING' })");
        expect(banner).toContain('UPDATE_RELOAD_FALLBACK_MS');
        expect(banner).toContain('WORKER_INSTALL_TIMEOUT_MS');
    });

    it('notifies the global banner without an undefined callback', () => {
        const html = readProjectFile('index.html');
        const banner = readProjectFile('components/UpdateBanner.tsx');

        expect(html).toContain("window.dispatchEvent(new Event('peliculas-br-pwa-update-ready'))");
        expect(html).not.toContain('showUpdateNotification');
        expect(banner).toContain('window.addEventListener(PWA_UPDATE_READY_EVENT, handleUpdateReady)');
        expect(banner).toContain('window.removeEventListener(PWA_UPDATE_READY_EVENT, handleUpdateReady)');
    });

    it('shows a friendly update action instead of entering a reload loop', () => {
        const recoveryScript = readRecoveryScript();

        expect(recoveryScript).toBeTruthy();

        (window as typeof window & { __isLocalDevHost?: boolean }).__isLocalDevHost = false;
        window.sessionStorage.setItem('peliculas-br-asset-recovery-at', String(Date.now()));
        window.eval(recoveryScript!);

        const recover = (window as typeof window & {
            __recoverPeliculasApp?: (reason: string) => void;
        }).__recoverPeliculasApp;
        recover?.('test stale bundle');

        expect(document.body.textContent).toContain('Vamos atualizar o aplicativo');
        expect(document.body.textContent).toContain('Atualizar aplicativo');
    });

    it('clears historical app caches while preserving unrelated caches', async () => {
        const recoveryScript = readRecoveryScript();
        const deleteCache = vi.fn().mockResolvedValue(true);

        Object.defineProperty(window, 'caches', {
            configurable: true,
            value: {
                keys: vi.fn().mockResolvedValue([
                    'peliculas-br-bd-v2.6.0',
                    'peliculas-br-bd-cache-v1',
                    'app-cache-v119',
                    'peliculas-brasil-v2',
                    'workbox-precache-v2-example',
                    'unrelated-cache'
                ]),
                delete: deleteCache
            }
        });

        (window as typeof window & { __isLocalDevHost?: boolean }).__isLocalDevHost = false;
        window.sessionStorage.setItem('peliculas-br-asset-recovery-at', String(Date.now()));
        window.eval(recoveryScript!);
        (window as typeof window & {
            __recoverPeliculasApp?: (reason: string) => void;
        }).__recoverPeliculasApp?.('test legacy caches');
        const button = document.getElementById('pwa-recovery-button');
        expect(button).not.toBeNull();
        button!.click();
        expect(button!.textContent).toBe('Atualizando...');

        await vi.waitFor(() => expect(deleteCache).toHaveBeenCalledTimes(5));
        expect(deleteCache).not.toHaveBeenCalledWith('unrelated-cache');
    });

    it('activates an already waiting worker without depending on the network', async () => {
        vi.useFakeTimers();
        const recoveryScript = readRecoveryScript();
        const postMessage = vi.fn();
        const registration = {
            waiting: { postMessage },
            installing: null,
            update: vi.fn().mockRejectedValue(new Error('network unavailable'))
        };

        Object.defineProperty(navigator, 'serviceWorker', {
            configurable: true,
            value: {
                getRegistration: vi.fn().mockResolvedValue(registration)
            }
        });

        (window as typeof window & { __isLocalDevHost?: boolean }).__isLocalDevHost = false;
        window.sessionStorage.setItem('peliculas-br-asset-recovery-at', String(Date.now()));
        window.eval(recoveryScript!);
        (window as typeof window & {
            __recoverPeliculasApp?: (reason: string) => void;
        }).__recoverPeliculasApp?.('test waiting worker');
        const button = document.getElementById('pwa-recovery-button');
        expect(button).not.toBeNull();
        button!.click();
        expect(button!.textContent).toBe('Atualizando...');

        for (let index = 0; index < 10; index += 1) {
            await Promise.resolve();
        }

        expect(registration.update).not.toHaveBeenCalled();
        expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    });

    it('rejects HTML returned in place of JavaScript or CSS', () => {
        const serviceWorker = readProjectFile('public/service-worker.js');

        expect(serviceWorker).toContain("const SW_VERSION = 'v2.7.3'");
        expect(serviceWorker).toContain('hasExpectedAssetContentType');
        expect(serviceWorker).toContain('isAppTechnicalCache');
        expect(serviceWorker).toContain("'app-cache-'");
        expect(serviceWorker).toContain('matchCurrentCache');
        expect(serviceWorker).not.toContain('caches.match(request)');
        expect(serviceWorker).toContain("statusText: 'Invalid asset response'");
        expect(serviceWorker).toContain("'Cache-Control': 'no-store'");
    });
});
