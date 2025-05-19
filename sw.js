const CACHE_NAME = 'binance-p2p-analyzer-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/404.html',
    '/css/styles.css',
    '/js/app.js',
    'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Estrategia de caché: Network First, fallback to Cache
self.addEventListener('fetch', (event) => {
    // No interceptar llamadas a la API de Binance
    if (event.request.url.includes('p2p.binance.com')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .catch(() => {
                return caches.match(event.request)
                    .then((response) => {
                        if (response) {
                            return response;
                        }
                        // Si el recurso no está en caché y estamos offline,
                        // devolver la página 404
                        if (event.request.mode === 'navigate') {
                            return caches.match('/404.html');
                        }
                        return new Response('Not Found', {
                            status: 404,
                            statusText: 'Not Found'
                        });
                    });
            })
    );
}); 