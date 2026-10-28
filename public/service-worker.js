// Service Worker com Auto-Atualização
// ========================================
// VERSÃO: Mude este número para forçar atualização nos clientes
const SW_VERSION = 'v2.7.7';
const CACHE_NAME = `peliculas-br-bd-${SW_VERSION}`;
const TECHNICAL_CACHE_PREFIXES = [
    'peliculas-br-bd-',
    'peliculas-brasil-',
    'app-cache-',
    'workbox-'
];
const TECHNICAL_CACHE_NAMES = ['pages-cache', 'assets-cache', 'images-cache'];

const isAppTechnicalCache = (cacheName) => (
    TECHNICAL_CACHE_NAMES.includes(cacheName)
    || TECHNICAL_CACHE_PREFIXES.some((prefix) => cacheName.startsWith(prefix))
);

// Ícones (Font Awesome) e fontes vêm de outros sites. Ficam num cache próprio,
// fora da limpeza por versão, porque os endereços não mudam a cada publicação.
const CDN_CACHE_NAME = 'peliculas-br-cdn-v1';
const CDN_HOSTS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

// Lista de recursos essenciais para cache offline
const ESSENTIAL_CACHE = [
    '/',
    '/offline.html'
];

// Com internet fraca, a abertura do app não espera mais que isto pela rede.
const NAVIGATION_TIMEOUT_MS = 4000;

const ASSET_REFERENCE_PATTERN = /\/?assets\/[A-Za-z0-9_.-]+\.(?:m?js|css|woff2?|ttf|otf|png|jpe?g|svg|webp|gif|wasm)/g;
const MAX_PRECACHE_FILES = 400;
const PRECACHE_PARALLEL_DOWNLOADS = 6;

const hasExpectedAssetContentType = (pathname, response) => {
    if (!pathname.startsWith('/assets/')) return true;

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (/\.m?js$/i.test(pathname)) {
        return contentType.includes('javascript');
    }
    if (/\.css$/i.test(pathname)) {
        return contentType.includes('text/css');
    }

    return !contentType.includes('text/html');
};

// Dentro dos próprios arquivos, alguns são citados só como "./nome.js" (mesma pasta).
const RELATIVE_ASSET_PATTERN = /["'`]\.\/([A-Za-z0-9_.-]+\.(?:m?js|css))["'`]/g;

const findAssetReferences = (text, insideAssets = false) => {
    const references = (text.match(ASSET_REFERENCE_PATTERN) || []).map((reference) => (
        reference.startsWith('/') ? reference : `/${reference}`
    ));
    if (insideAssets) {
        for (const match of text.matchAll(RELATIVE_ASSET_PATTERN)) {
            references.push(`/assets/${match[1]}`);
        }
    }
    return references;
};

// Arquivos com hash no nome têm o mesmo conteúdo em qualquer versão: reaproveita
// o que já está no aparelho para não baixar de novo a cada publicação.
const findAssetInPreviousCaches = async (pathname) => {
    const cacheNames = (await caches.keys())
        .filter((name) => name.startsWith('peliculas-br-bd-') && name !== CACHE_NAME);

    for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const response = await cache.match(pathname);
        if (response && response.ok && hasExpectedAssetContentType(pathname, response)) {
            return response;
        }
    }

    return null;
};

const downloadAssetForPrecache = async (cache, pathname) => {
    const alreadyCached = await cache.match(pathname);
    if (alreadyCached) return alreadyCached;

    let response = await findAssetInPreviousCaches(pathname);
    if (!response) {
        response = await fetch(pathname);
        if (!response.ok || !hasExpectedAssetContentType(pathname, response)) {
            return null;
        }
    }

    await cache.put(pathname, response.clone());
    return response;
};

// Guarda o app inteiro (todas as telas), não só as que o usuário já abriu.
// Parte do index.html e segue os arquivos citados dentro de cada JS/CSS.
// Falha num arquivo não impede a instalação: ele é baixado quando for usado.
const precacheAppFiles = async (cache) => {
    const shell = await cache.match('/');
    if (!shell) return;

    const queue = findAssetReferences(await shell.text());
    const seen = new Set();
    let failures = 0;

    const processAsset = async (pathname) => {
        try {
            const response = await downloadAssetForPrecache(cache, pathname);
            if (!response) {
                failures += 1;
                return;
            }
            if (/\.(?:m?js|css)$/i.test(pathname)) {
                queue.push(...findAssetReferences(await response.text(), true));
            }
        } catch (error) {
            failures += 1;
        }
    };

    while (queue.length > 0 && seen.size < MAX_PRECACHE_FILES) {
        const batch = [];
        while (queue.length > 0 && batch.length < PRECACHE_PARALLEL_DOWNLOADS && seen.size < MAX_PRECACHE_FILES) {
            const pathname = queue.shift();
            if (seen.has(pathname)) continue;
            seen.add(pathname);
            batch.push(processAsset(pathname));
        }
        await Promise.all(batch);
    }

    console.log(`[SW ${SW_VERSION}] ${seen.size - failures} arquivos guardados para uso offline (${failures} falharam)`);
};

const cdnCacheFirst = async (request) => {
    const cache = await caches.open(CDN_CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    // Folhas de estilo carregadas sem CORS chegam "opacas" (status 0), mas valem.
    if (response.ok || response.type === 'opaque') {
        cache.put(request, response.clone()).catch(() => undefined);
    }
    return response;
};

const isAppPagePath = (pathname) => !/\.[a-z0-9]+$/i.test(pathname);

// Abertura do app: tenta a rede, mas sem internet (ou se ela demora) usa a página
// guardada na instalação. Ela combina com os arquivos guardados desta versão, por
// isso a resposta da rede não a substitui. Qualquer endereço do app (com ?tab=,
// vindo de um aviso da agenda etc.) abre a mesma página inicial.
const navigationResponse = async (request) => {
    const cache = await caches.open(CACHE_NAME);
    const pathname = new URL(request.url).pathname;
    const savedPage = async () => (
        await cache.match(request) || (isAppPagePath(pathname) ? await cache.match('/') : undefined)
    );

    const network = fetch(request);
    let timer;
    const slowNetwork = new Promise((resolve) => {
        timer = setTimeout(() => resolve(null), NAVIGATION_TIMEOUT_MS);
    });

    try {
        const first = await Promise.race([network, slowNetwork]);
        if (first) return first;

        const saved = await savedPage();
        if (saved) {
            network.catch(() => undefined);
            return saved;
        }
        return await network;
    } catch (error) {
        return await savedPage()
            || await cache.match('/offline.html')
            || new Response('', { status: 503, statusText: 'Offline' });
    } finally {
        clearTimeout(timer);
    }
};

// Instalação - cacheia recursos essenciais e o app inteiro
self.addEventListener('install', (event) => {
    console.log(`[SW ${SW_VERSION}] Instalando...`);

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log(`[SW ${SW_VERSION}] Cacheando recursos essenciais`);
                // 'reload' evita pegar um index.html antigo do cache do navegador,
                // que apontaria para arquivos de outra versão.
                return cache.addAll(ESSENTIAL_CACHE.map((path) => new Request(path, { cache: 'reload' })))
                    .then(() => precacheAppFiles(cache));
            })
            .then(() => {
                // NÃO força skipWaiting aqui. O novo Service Worker fica em "waiting"
                // até o usuário clicar em "Atualizar Agora" no banner (SKIP_WAITING).
                // Isso evita ativação automática + reload em loop.
                console.log(`[SW ${SW_VERSION}] Instalado e aguardando ativação pelo usuário`);
            })
    );
});

// Ativação - limpa caches antigos e assume controle
self.addEventListener('activate', (event) => {
    console.log(`[SW ${SW_VERSION}] Ativando...`);

    event.waitUntil(
        Promise.all([
            // Limpa caches de versões antigas
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME && isAppTechnicalCache(cacheName)) {
                            console.log(`[SW ${SW_VERSION}] Removendo cache antigo:`, cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            // CRÍTICO: Assume controle de todas as abas/janelas imediatamente
            self.clients.claim()
        ]).then(() => {
            // Notifica todas as abas/janelas que há uma nova versão
            return self.clients.matchAll({ type: 'window' }).then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({
                        type: 'SW_UPDATED',
                        version: SW_VERSION
                    });
                });
            });
        })
    );
});

// Estratégia de fetch:
// - assets com hash: Cache First (o nome muda a cada build);
// - HTML e demais recursos: Network First para detectar atualizações.
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    const isLocalDev = ['localhost', '127.0.0.1'].includes(url.hostname);
    const isViteRequest =
        url.pathname.startsWith('/@vite') ||
        url.pathname.startsWith('/@react-refresh') ||
        url.pathname.startsWith('/node_modules/') ||
        url.pathname.endsWith('.ts') ||
        url.pathname.endsWith('.tsx');

    // Ignora requisições não-GET
    if (request.method !== 'GET') return;

    // Ícones e fontes de outros sites: guardados no primeiro uso para aparecerem sem internet
    if (CDN_HOSTS.includes(url.hostname)) {
        event.respondWith(cdnCacheFirst(request));
        return;
    }

    // Ignora extensões do Chrome e outras origens
    if (url.origin !== location.origin) return;
    if (isLocalDev || isViteRequest) return;

    // Ignora requisições de API (supabase, etc)
    if (url.pathname.includes('/api/') || url.hostname.includes('supabase')) return;

    if (request.mode === 'navigate') {
        event.respondWith(navigationResponse(request));
        return;
    }

    const isHashedAsset = url.pathname.startsWith('/assets/');

    const fetchAndCache = () => (
        fetch(request)
            .then((response) => {
                // Um bundle antigo inexistente pode cair no fallback da SPA e receber
                // index.html com status 200. Nunca devolvemos nem armazenamos HTML como
                // JavaScript/CSS: o erro aciona a recuperacao segura no index.
                if (response && response.status === 200 && !hasExpectedAssetContentType(url.pathname, response)) {
                    return new Response('', {
                        status: 502,
                        statusText: 'Invalid asset response',
                        headers: {
                            'Cache-Control': 'no-store',
                            'Content-Type': 'text/plain; charset=utf-8'
                        }
                    });
                }

                // Se a resposta for válida, atualiza o cache
                if (response && response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseToCache);
                    });
                }
                return response;
            })
    );

    // Nunca consulta caches globais/legados. Mesmo que a exclusao de um cache
    // antigo falhe, apenas a versao ativa pode responder a uma requisicao.
    const matchCurrentCache = () => (
        caches.open(CACHE_NAME).then((cache) => cache.match(request))
    );

    if (isHashedAsset) {
        event.respondWith(
            matchCurrentCache().then((cachedResponse) => {
                if (cachedResponse && hasExpectedAssetContentType(url.pathname, cachedResponse)) {
                    return cachedResponse;
                }

                return fetchAndCache().catch(() => (
                    new Response('', { status: 503, statusText: 'Offline' })
                ));
            })
        );
        return;
    }

    event.respondWith(
        fetchAndCache().catch(() => {
            return matchCurrentCache().then((response) => {
                if (response) {
                    return response;
                }
                return new Response('', { status: 503, statusText: 'Offline' });
            });
        })
    );
});

// Escuta mensagens do cliente
self.addEventListener('message', (event) => {
    if (event.data) {
        switch (event.data.type) {
            case 'SKIP_WAITING':
                console.log(`[SW ${SW_VERSION}] Recebido SKIP_WAITING, ativando agora...`);
                self.skipWaiting();
                break;

            case 'GET_VERSION':
                event.ports[0].postMessage({ version: SW_VERSION });
                break;

            case 'CLEAR_ALL_CACHES':
                console.log(`[SW ${SW_VERSION}] Limpando caches tecnicos do aplicativo...`);
                caches.keys().then((names) => {
                    return Promise.all(
                        names
                            .filter(isAppTechnicalCache)
                            .map((name) => caches.delete(name))
                    );
                }).then(() => {
                    event.ports[0].postMessage({ success: true });
                });
                break;
        }
    }
});

function getNotificationUrl(data) {
    if (data && typeof data.url === 'string' && data.url.startsWith('/')) {
        return data.url;
    }

    return '/?tab=agenda';
}

function getMapsUrl(data) {
    if (data && typeof data.mapsUrl === 'string' && /^https:\/\/www\.google\.com\/maps\//.test(data.mapsUrl)) {
        return data.mapsUrl;
    }

    return null;
}

function getNotificationActions(payload) {
    if (Array.isArray(payload.actions)) {
        return payload.actions
            .filter((action) => action && typeof action.action === 'string' && typeof action.title === 'string')
            .slice(0, 2);
    }

    return [{ action: 'open-agenda', title: 'Abrir agenda' }];
}

function getReceipt(data) {
    const receipt = data && data.receipt;
    if (!receipt || typeof receipt !== 'object') return null;
    if (typeof receipt.url !== 'string') return null;
    if (typeof receipt.kind !== 'string') return null;
    if (typeof receipt.id !== 'string') return null;
    if (typeof receipt.token !== 'string') return null;

    return receipt;
}

async function recordPushReceipt(data, stage, error) {
    const receipt = getReceipt(data);
    if (!receipt) return;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        await fetch(receipt.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                kind: receipt.kind,
                id: receipt.id,
                token: receipt.token,
                stage,
                error: error ? String(error).slice(0, 500) : null,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeout);
    } catch (receiptError) {
        console.warn(`[SW ${SW_VERSION}] Falha ao registrar recibo de push:`, receiptError);
    }
}

self.addEventListener('push', (event) => {
    let payload = {};

    try {
        payload = event.data ? event.data.json() : {};
    } catch (_error) {
        payload = {};
    }

    const title = payload.title || 'Agenda';
    const options = {
        body: payload.body || 'Voce tem um atendimento agendado.',
        icon: payload.icon || '/icon-192x192.png',
        badge: payload.badge || '/icon-192x192.png',
        tag: payload.tag || 'agenda-reminder',
        renotify: true,
        silent: false,
        timestamp: payload.timestamp || Date.now(),
        vibrate: payload.vibrate || [180, 80, 180],
        requireInteraction: Boolean(payload.requireInteraction),
        data: {
            url: getNotificationUrl(payload),
            mapsUrl: getMapsUrl(payload),
            agendamentoId: payload.agendamentoId || null,
            receipt: getReceipt(payload),
        },
        actions: getNotificationActions(payload),
    };

    event.waitUntil((async () => {
        await recordPushReceipt(payload, 'received');

        try {
            await self.registration.showNotification(title, options);
            await recordPushReceipt(payload, 'shown');
        } catch (error) {
            await recordPushReceipt(payload, 'show_failed', error && error.message ? error.message : error);
            throw error;
        }
    })());
});

// Mapeia os botoes de acao do alerta de encerramento para o status operacional.
const SERVICE_STATUS_ACTIONS = {
    'mark-completed': 'completed',
    'mark-cancelled': 'cancelled',
    'mark-no-show': 'no_show',
};

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const data = event.notification.data || {};
    const mapsUrl = getMapsUrl(data);

    // Botoes de status do alerta "atendimento encerrado": marca direto e abre o app.
    const serviceStatus = SERVICE_STATUS_ACTIONS[event.action];
    if (serviceStatus && data.agendamentoId) {
        const statusUrl = new URL(getNotificationUrl(data), self.location.origin);
        statusUrl.searchParams.set('markAgendamento', String(data.agendamentoId));
        statusUrl.searchParams.set('serviceStatus', serviceStatus);
        const statusHref = statusUrl.href;

        event.waitUntil(
            Promise.all([
                recordPushReceipt(data, 'clicked'),
                self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
                    for (const client of clients) {
                        if ('focus' in client) {
                            // App ja aberto: aplica na hora via mensagem.
                            client.postMessage({
                                type: 'MARK_SERVICE_STATUS',
                                agendamentoId: data.agendamentoId,
                                serviceStatus,
                            });
                            client.navigate(statusHref);
                            return client.focus();
                        }
                    }

                    if (self.clients.openWindow) {
                        return self.clients.openWindow(statusHref);
                    }

                    return undefined;
                }),
            ])
        );
        return;
    }

    // Botao "Como chegar": abre o Google Maps em uma nova aba.
    if (event.action === 'navigate' && mapsUrl) {
        event.waitUntil(
            Promise.all([
                recordPushReceipt(data, 'clicked'),
                self.clients.openWindow ? self.clients.openWindow(mapsUrl) : Promise.resolve(),
            ])
        );
        return;
    }

    const urlToOpen = new URL(getNotificationUrl(data), self.location.origin).href;

    event.waitUntil(
        Promise.all([
            recordPushReceipt(data, 'clicked'),
            self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
                if ('focus' in client) {
                    client.navigate(urlToOpen);
                    return client.focus();
                }
            }

            if (self.clients.openWindow) {
                return self.clients.openWindow(urlToOpen);
            }

            return undefined;
            })
        ])
    );
});

console.log(`[SW ${SW_VERSION}] Service Worker carregado`);
