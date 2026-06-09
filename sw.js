const CACHE_NAME = 'pwa-install-cache-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Only intercept local GET requests to avoid breaking external analytics, maps, or other cross-origin assets
    if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
        return; // Let browser handle it natively
    }

    event.respondWith(
        fetch(event.request).catch((err) => {
            console.warn('SW fetch failed:', err);
            // Return a valid Response object instead of undefined to satisfy browser API contract
            return new Response('Network error', { status: 480, statusText: 'Network Error' });
        })
    );
});
