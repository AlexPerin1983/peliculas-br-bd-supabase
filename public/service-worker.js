// Service Worker com Auto-Atualização
// ========================================
// VERSÃO: Mude este número para forçar atualização nos clientes
const SW_VERSION = 'v2.6.0';
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
    const isHashedAsset = url.pathname.startsWith('/assets/');
    const isJavaScriptAsset = isHashedAsset && /\.m?js$/i.test(url.pathname);
    const isCssAsset = isHashedAsset && /\.css$/i.test(url.pathname);

    const hasExpectedAssetContentType = (response) => {
        if (!isHashedAsset) return true;

        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        if (isJavaScriptAsset) {
            return contentType.includes('javascript');
        }
        if (isCssAsset) {
            return contentType.includes('text/css');
        }

        return !contentType.includes('text/html');
    };

    event.respondWith(
        fetch(request)
            .then((response) => {
                // Um bundle antigo inexistente pode cair no fallback da SPA e receber
                // index.html com status 200. Nunca devolvemos nem armazenamos HTML como
                // JavaScript/CSS: o erro aciona a recuperacao segura no index.
                if (response && response.status === 200 && !hasExpectedAssetContentType(response)) {
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
