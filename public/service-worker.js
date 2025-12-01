// Simple Service Worker without Workbox CDN
// PARA FORÇAR UMA NOVA VERSÃO: Altere o número da versão abaixo (ex: v71 -> v72)
const CACHE_NAME = 'app-cache-v72';
const urlsToCache = [
    '/',
    '/offline.html'
];

// Força o Service Worker a assumir o controle imediatamente após a instalação
self.addEventListener('install', (event) => {
    // console.log('[SW] Installing version 71...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // console.log('[SW] Caching app shell');
            return cache.addAll(urlsToCache);
        }).then(() => {
            // console.log('[SW] Skip waiting - force activation');
            return self.skipWaiting();
        })
    );
});

// Ativa imediatamente quando houver uma nova versão
self.addEventListener('activate', (event) => {
    // console.log('[SW] Activating version 71...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        // console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// Network First strategy for HTML, Cache First for assets
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip chrome extensions and other origins
    if (url.origin !== location.origin) return;

    // Network First for HTML/navigation
    if (request.mode === 'navigate' || request.destination === 'document') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Clone and cache the response
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseToCache);
                    });
                    return response;
                })
                .catch(() => {
                    // Fallback to cache, then offline page
                    return caches.match(request).then((response) => {
                        return response || caches.match('/offline.html');
                    });
                })
        );
        return;
    }

    // Cache First for assets (CSS, JS, images)
    event.respondWith(
        caches.match(request).then((response) => {
            if (response) {
                return response;
            }
            return fetch(request).then((response) => {
                // Don't cache if not a success response
                if (!response || response.status !== 200 || response.type === 'error') {
                    return response;
                }
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(request, responseToCache);
                });
                return response;
            });
        })
    );
});

// Listen for skip waiting message
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        // console.log('[SW] Skip waiting message received');
        self.skipWaiting();
    }
});

// console.log('[SW] Service Worker v71 loaded');