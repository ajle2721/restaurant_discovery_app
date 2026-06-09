const CACHE_NAME = 'pwa-install-cache-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Satisfy PWA criteria by responding to fetch events
    // Fetch directly from the network to avoid caching outdated files
    event.respondWith(
        fetch(event.request).catch((err) => {
            // Silently fail if offline or network unavailable
        })
    );
});
