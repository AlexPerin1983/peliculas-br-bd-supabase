// Standalone regression: node tests/pwa/recovery.browser.cjs
// PWA_TEST_BROWSER_CHANNEL=msedge uses the installed Edge on Windows.
// Runs a local fixture only; never starts the app or loads its services.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('@playwright/test');

const root = path.resolve(__dirname, '../..');
const output = process.env.PWA_RECOVERY_TEST_OUTPUT
    || path.join(os.tmpdir(), `peliculas-br-pwa-recovery-${process.pid}`);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const recovery = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map(match => match[1])
    .find(script => script.includes('peliculas-br-asset-recovery-at'));
assert.ok(recovery, 'Recovery bootstrap must exist');

const stalePage = `<!doctype html><html lang="pt-BR"><head>
    <meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
    <script>window.__isLocalDevHost = false;</script><script>${recovery}</script>
    <script type="module" src="/assets/removed-build.js"></script></body></html>`;
// Models an old installation which keeps serving its obsolete shell after reload.
const stuckWorker = `
    self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
    self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
    self.addEventListener('fetch', event => {
        if (event.request.mode === 'navigate') {
            event.respondWith(Promise.resolve(new Response(${JSON.stringify(stalePage)}, {
                headers: { 'Content-Type': 'text/html' }
            })));
        }
    });`;

const server = http.createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    if (request.url.startsWith('/service-worker.js')) {
        response.setHeader('Content-Type', 'application/javascript');
        response.end(stuckWorker);
    } else if (request.url.startsWith('/assets/removed-build.js')) {
        response.writeHead(404, { 'Content-Type': 'text/plain' });
        response.end('Previous build is no longer available');
    } else {
        response.setHeader('Content-Type', 'text/html');
        response.end(`<!doctype html><html lang="pt-BR">
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <body style="font-family:system-ui;padding:24px">
            <h1 id="fresh-build">Nova versão carregada</h1>
            <p>Teste isolado de atualização do PWA.</p>
            <p>Dados locais preservados.</p></body></html>`);
    }
});

async function readLocalData(page) {
    return page.evaluate(async () => {
        const request = indexedDB.open('pwa-recovery-fixture', 1);
        const db = await new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        try {
            const read = db.transaction('pending').objectStore('pending').get('work');
            const pendingWork = await new Promise((resolve, reject) => {
                read.onsuccess = () => resolve(read.result);
                read.onerror = () => reject(read.error);
            });
            return {
                pendingWork,
                session: localStorage.getItem('test-session'),
                unrelatedCache: (await caches.keys()).includes('other-tool-cache'),
            };
        } finally {
            db.close();
        }
    });
}

(async () => {
    fs.mkdirSync(output, { recursive: true });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    let browser;
    try {
        browser = await chromium.launch({
            channel: process.env.PWA_TEST_BROWSER_CHANNEL || undefined,
            headless: true,
        });
        const context = await browser.newContext({
            viewport: { width: 390, height: 844 },
            isMobile: true,
            hasTouch: true,
            deviceScaleFactor: 1,
            userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
        });
        const externalRequests = [];
        context.on('request', request => {
            if (new URL(request.url()).origin !== origin) externalRequests.push(request.url());
        });
        await context.route('**/*', route => new URL(route.request().url()).origin === origin
            ? route.continue() : route.abort());
        const page = await context.newPage();
        await page.goto(`${origin}/setup`);
        await page.evaluate(async () => {
            localStorage.setItem('test-session', 'dummy-session-preserved');
            const request = indexedDB.open('pwa-recovery-fixture', 1);
            request.onupgradeneeded = () => request.result.createObjectStore('pending');
            const db = await new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            await new Promise((resolve, reject) => {
                const tx = db.transaction('pending', 'readwrite');
                tx.objectStore('pending').put({ description: 'Offline work', amount: 480 }, 'work');
                tx.oncomplete = resolve;
                tx.onerror = () => reject(tx.error);
            });
            db.close();
            await caches.open('other-tool-cache');
            await caches.open('peliculas-br-bd-v2.7.5');
            await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
            await navigator.serviceWorker.ready;
        });
        await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
        await page.goto(`${origin}/`);
        const updateButton = page.locator('#pwa-recovery-button');
        await updateButton.waitFor({ timeout: 15_000 });
        const before = await readLocalData(page);
        await page.screenshot({ path: path.join(output, 'recuperacao.png') });
        await updateButton.click();
        await page.locator('#fresh-build').waitFor({ timeout: 15_000 });
        assert.equal(await page.locator('#pwa-recovery-screen').count(), 0);
        assert.deepEqual(await readLocalData(page), before);
        assert.deepEqual(externalRequests, []);
        assert.equal(await page.evaluate(async () => (
            await navigator.serviceWorker.getRegistration()
        ) !== undefined), false);
        await page.screenshot({ path: path.join(output, 'recuperado.png') });
        const result = {
            fixture: 'Local fixture with real Chromium service worker and Android emulation',
            updateLoopResolved: true,
            offlineDataPreserved: true,
            sessionPreserved: true,
            unrelatedCachePreserved: true,
            externalRequests: 0,
        };
        fs.writeFileSync(path.join(output, 'browser-regression.json'), JSON.stringify(result, null, 2));
        console.log(JSON.stringify(result));
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
