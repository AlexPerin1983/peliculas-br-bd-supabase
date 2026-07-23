import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const readProjectFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

afterEach(() => {
    document.getElementById('pwa-recovery-screen')?.remove();
    window.sessionStorage.clear();
    delete (window as typeof window & { __recoverPeliculasApp?: unknown }).__recoverPeliculasApp;
    delete (window as typeof window & { __isLocalDevHost?: unknown }).__isLocalDevHost;
});

describe('PWA stale asset recovery', () => {
    it('does not rewrite missing hashed assets to the SPA HTML', () => {
        const config = JSON.parse(readProjectFile('vercel.json'));
        const spaRewrite = config.rewrites.find((rewrite: { destination: string }) => (
            rewrite.destination === '/index.html'
        ));

        expect(spaRewrite?.source).toBe('/((?!assets/).*)');
    });

    it('recovers stale module failures without clearing offline data', () => {
        const html = readProjectFile('index.html');

        expect(html).toContain("window.addEventListener('vite:preloadError'");
        expect(html).toContain("window.addEventListener('unhandledrejection'");
        expect(html).toContain("name.indexOf(CACHE_PREFIX) === 0");
        expect(html).toContain('Seus dados e trabalhos offline serão preservados.');
        expect(html).not.toContain('indexedDB.deleteDatabase');
        expect(html).not.toContain('localStorage.clear');
    });

    it('shows a friendly update action instead of entering a reload loop', () => {
        const html = readProjectFile('index.html');
        const recoveryScript = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
            .map(match => match[1])
            .find(script => script.includes('peliculas-br-asset-recovery-at'));

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

    it('rejects HTML returned in place of JavaScript or CSS', () => {
        const serviceWorker = readProjectFile('public/service-worker.js');

        expect(serviceWorker).toContain("const SW_VERSION = 'v2.6.0'");
        expect(serviceWorker).toContain('hasExpectedAssetContentType');
        expect(serviceWorker).toContain("statusText: 'Invalid asset response'");
        expect(serviceWorker).toContain("'Cache-Control': 'no-store'");
    });
});
