// Service Worker com Auto-Atualização
// ========================================
// VERSÃO: Mude este número para forçar atualização nos clientes
const SW_VERSION = 'v2.0.0';
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

    // Ignora requisições não-GET
    if (request.method !== 'GET') return;

    // Ignora extensões do Chrome e outras origens
    if (url.origin !== location.origin) return;

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

console.log(`[SW ${SW_VERSION}] Service Worker carregado`);
