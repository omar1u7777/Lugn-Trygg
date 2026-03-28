const CACHE_NAME = 'lugn-trygg-v3-production';
const urlsToCache = [
  '/',
  '/site.webmanifest'
  // Assets will be cached dynamically on first load
  // Note: favicon.ico and manifest.json removed as they don't exist
];

// Install Service Worker
self.addEventListener('install', (event) => {
  console.log('🚀 Service Worker installing for production...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('✅ Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('❌ Cache add failed:', error);
      })
  );
  self.skipWaiting();
});

// CRITICAL FIX: Enhanced fetch event with offline support and API caching
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Navigation requests must prefer network to avoid stale HTML that points to old JS chunks.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put('/index.html', responseToCache);
          });
          return response;
        })
        .catch(() => caches.match('/index.html').then((cached) => cached || caches.match('/')))
    );
    return;
  }
  
  // CRITICAL FIX: Don't cache API requests that require authentication
  if (url.pathname.startsWith('/api/')) {
    // API requests: Network-first strategy with offline fallback
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful GET requests only
          if (request.method === 'GET' && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline: Try to return cached version
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // No cache: Return offline response for API calls
            return new Response(
              JSON.stringify({ 
                error: 'Offline', 
                message: 'Nätverksfel. Kontrollera din internetanslutning.' 
              }),
              {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' }
              }
            );
          });
        })
    );
    return;
  }
  
  // Static assets: Cache-first strategy
  event.respondWith(
    caches.match(request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Fetch from network
        return fetch(request).then(
          (response) => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic' || request.method !== 'GET') {
              return response;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache);
              });

            return response;
          }
        );
      })
      .catch(() => {
        // Never return HTML for non-navigation asset requests.
        // Returning index.html for JS/CSS causes runtime parse errors and app crashes.
        if (request.destination === 'document' || request.mode === 'navigate') {
          return caches.match('/index.html').then((cachedIndex) => {
            if (cachedIndex) return cachedIndex;
            return caches.match('/').then((cachedRoot) => {
              if (cachedRoot) return cachedRoot;
              return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
            });
          });
        }

        return caches.match(request).then((cachedAsset) => {
          if (cachedAsset) return cachedAsset;
          return new Response('', { status: 504, statusText: 'Gateway Timeout' });
        });
      })
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating.');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Background sync for mood data
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync-mood') {
    event.waitUntil(syncMoodData());
  }
});

async function syncMoodData() {
  try {
    // Get pending mood data from IndexedDB or similar
    const pendingData = await getPendingMoodData();

    if (pendingData && pendingData.length > 0) {
      // Send data to backend
      const response = await fetch('/api/mood/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pendingData)
      });

      if (response.ok) {
        // Clear pending data
        await clearPendingMoodData();
        // Notify client
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'SYNC_COMPLETE',
              data: pendingData
            });
          });
        });
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Placeholder functions - implement based on your storage solution
async function getPendingMoodData() {
  // Implement IndexedDB or similar storage retrieval
  return [];
}

async function clearPendingMoodData() {
  // Implement clearing of pending data
}