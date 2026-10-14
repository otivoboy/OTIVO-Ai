const CACHE_NAME = 'otivo-antigravity-cache-v1';

// We install instantly and skip waiting to ensure the SW takes over right away.
self.addEventListener('install', (event) => {
  console.log('[OTIVO Antigravity] Service Worker installing...');
  self.skipWaiting();
});

// Take over all clients so hydration works on the immediate next reload
self.addEventListener('activate', (event) => {
  console.log('[OTIVO Antigravity] Service Worker activated.');
  event.waitUntil(self.clients.claim());
});

// A basic cache-first strategy for static assets, 
// and network-first for WebContainer local proxy requests.
self.addEventListener('fetch', (event) => {
  // If the request points to the local dev server domain/proxy,
  // we do not want to cache it, we want it to hit the WebContainer.
  if (event.request.url.includes('webcontainer.io') || event.request.url.includes('localhost')) {
    return;
  }

  // Basic stale-while-revalidate for standard assets (CSS, images)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse.status === 0) {
          return networkResponse;
        }

        // Cache successful GET responses only
        if (event.request.method === 'GET' && networkResponse.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
        }

        // INJECT COOP/COEP HEADERS
        const newHeaders = new Headers(networkResponse.headers);
        newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
        newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
        newHeaders.set("Cross-Origin-Resource-Policy", "cross-origin");

        return new Response(networkResponse.body, {
          status: networkResponse.status,
          statusText: networkResponse.statusText,
          headers: newHeaders,
        });
      }).catch((err) => {
        console.error('[OTIVO SW] Fetch failed:', err);
      });

      if (cachedResponse) {
        const newHeaders = new Headers(cachedResponse.headers);
        newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
        newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
        newHeaders.set("Cross-Origin-Resource-Policy", "cross-origin");

        return new Response(cachedResponse.body, {
          status: cachedResponse.status,
          statusText: cachedResponse.statusText,
          headers: newHeaders,
        });
      }

      return fetchPromise;
    })
  );
});

// Background sync / "Keep Alive" simulated event listener
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PING') {
    // Replicate keeping the container environment artificially warm
    // In a full architecture, this would communicate with shared workers
    event.ports[0].postMessage({ type: 'PONG', status: 'ALIVE' });
  }
});
