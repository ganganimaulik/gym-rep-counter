const CACHE_NAME = 'rep-counter-cache-v1';
const urlsToCache = [
    './',
    './index.html',
    './manifest.json',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png'
    // Note: External resources (tailwind, google fonts, nosleep.js) are not cached.
    // Caching them would require a more complex service worker strategy.
];

// Install the service worker and cache the app shell
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                // We use addAll which is atomic: if one file fails, the whole operation fails.
                return cache.addAll(urlsToCache).catch(error => {
                    console.error('Failed to cache all resources:', error);
                    // Even if some icons fail, we don't want to fail the entire install.
                    // A more robust implementation would handle this more gracefully.
                });
            })
    );
});

// Serve cached content when offline
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    return response;
                }

                // Not in cache - fetch from network
                return fetch(event.request);
            }
            )
    );
});

// Clean up old caches
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
