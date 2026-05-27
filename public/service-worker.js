// Service Worker com Auto-Atualização
// ========================================
// VERSÃO: Mude este número para forçar atualização nos clientes
const SW_VERSION = 'v2.3.3';
const CACHE_NAME = `peliculas-br-bd-${SW_VERSION}`;

// Lista de recursos essenciais para cache offline
const ESSENTIAL_CACHE = [
    '/',
    '/offline.html'
];

// Instalação - cacheia recursos essenciais
self.addEventListener('install', (event) => {
    console.log(`[SW ${SW_VERSION}] Instalando...`);

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log(`[SW ${SW_VERSION}] Cacheando recursos essenciais`);
                return cache.addAll(ESSENTIAL_CACHE);
            })
            .then(() => {
                console.log(`[SW ${SW_VERSION}] Ativando imediatamente (skipWaiting)`);
                // CRÍTICO: Força a ativação imediata sem esperar
                return self.skipWaiting();
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
                        if (cacheName !== CACHE_NAME && cacheName.startsWith('peliculas-br-bd')) {
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

// Estratégia de Fetch: Network First para tudo
// Isso garante que sempre tente buscar a versão mais recente
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

    // Ignora extensões do Chrome e outras origens
    if (url.origin !== location.origin) return;
    if (isLocalDev || isViteRequest) return;

    // Ignora requisições de API (supabase, etc)
    if (url.pathname.includes('/api/') || url.hostname.includes('supabase')) return;

    // NETWORK FIRST para TUDO (HTML, JS, CSS, etc)
    // Isso resolve o problema de versões antigas ficarem em cache
    event.respondWith(
        fetch(request)
            .then((response) => {
                // Se a resposta for válida, atualiza o cache
                if (response && response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                // Se offline, tenta buscar do cache
                return caches.match(request).then((response) => {
                    if (response) {
                        return response;
                    }
                    // Se for navegação e não tiver cache, mostra página offline
                    if (request.mode === 'navigate') {
                        return caches.match('/offline.html');
                    }
                    // Para outros recursos, retorna resposta vazia
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
                console.log(`[SW ${SW_VERSION}] Limpando TODOS os caches...`);
                caches.keys().then((names) => {
                    Promise.all(names.map((name) => caches.delete(name)));
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
            agendamentoId: payload.agendamentoId || null,
            receipt: getReceipt(payload),
        },
        actions: [
            {
                action: 'open-agenda',
                title: 'Abrir agenda',
            },
        ],
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

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const urlToOpen = new URL(getNotificationUrl(event.notification.data || {}), self.location.origin).href;

    event.waitUntil(
        Promise.all([
            recordPushReceipt(event.notification.data || {}, 'clicked'),
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
