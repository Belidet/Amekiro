// Family Reminder Tracker - Service Worker
const CACHE_NAME = 'family-tracker-v2'; // Updated version
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  '/icons/cross.svg',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@300;400;500;600&family=Cinzel:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.10/index.global.min.js'
];

// Install event - cache core assets
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching core assets');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('[Service Worker] Cache addAll failed:', error);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin) && 
      !event.request.url.includes('fonts.googleapis.com') &&
      !event.request.url.includes('cdnjs.cloudflare.com') &&
      !event.request.url.includes('cdn.jsdelivr.net')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        
        // Clone the request
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then(response => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clone the response
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then(cache => {
              // Don't cache API calls or authentication requests
              const url = event.request.url;
              if (!url.includes('/api/') && !url.includes('/auth/')) {
                cache.put(event.request, responseToCache);
              }
            })
            .catch(error => {
              console.error('[Service Worker] Cache put failed:', error);
            });
          
          return response;
        }).catch(error => {
          console.error('[Service Worker] Fetch failed:', error);
          
          // Try to serve offline fallback for HTML pages
          if (event.request.headers.get('accept').includes('text/html')) {
            return caches.match('/index.html');
          }
          
          return new Response('Network error occurred', {
            status: 408,
            statusText: 'Network Error',
            headers: new Headers({
              'Content-Type': 'text/plain'
            })
          });
        });
      })
  );
});

// Background sync for offline completions
self.addEventListener('sync', event => {
  console.log('[Service Worker] Sync event:', event.tag);
  if (event.tag === 'sync-completions') {
    event.waitUntil(syncCompletions());
  }
});

// Handle push notifications
self.addEventListener('push', event => {
  console.log('[Service Worker] Push received:', event);
  
  let data = {
    title: 'የአመክሮ ቤተሰብ መከታተያ',
    body: 'Time for your daily spiritual tasks!',
    icon: '/icons/cross.svg',
    badge: '/icons/cross.svg'
  };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon || '/icons/cross.svg',
    badge: data.badge || '/icons/cross.svg',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification click:', event);
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(windowClients => {
      // Check if there's already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window/tab
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Handle messages from the client
self.addEventListener('message', event => {
  console.log('[Service Worker] Message received:', event.data);
  
  if (event.data.type === 'CACHE_UPDATED') {
    // Force refresh of cached assets
    caches.open(CACHE_NAME).then(cache => {
      cache.addAll(urlsToCache);
    });
  }
  
  if (event.data.type === 'CLEAR_CACHE') {
    // Clear all caches
    caches.keys().then(cacheNames => {
      cacheNames.forEach(cacheName => {
        caches.delete(cacheName);
      });
    });
  }
});

// Helper function to sync offline completions
async function syncCompletions() {
  console.log('[Service Worker] Syncing completions...');
  
  try {
    // Get all clients
    const clients = await self.clients.matchAll();
    if (clients.length > 0) {
      // Send message to the first client to sync completions
      clients[0].postMessage({ 
        type: 'SYNC_COMPLETIONS',
        timestamp: new Date().toISOString()
      });
    }
    
    // Store sync attempt in IndexedDB (optional)
    const syncAttempt = {
      timestamp: new Date().toISOString(),
      status: 'attempted'
    };
    
    // You can store this in IndexedDB for tracking offline operations
    console.log('[Service Worker] Sync completed at:', syncAttempt.timestamp);
    
  } catch (error) {
    console.error('[Service Worker] Sync failed:', error);
    throw error; // Will retry on next sync
  }
}

// Network status monitoring
self.addEventListener('online', () => {
  console.log('[Service Worker] Network is online');
  // Notify clients that we're back online
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'NETWORK_ONLINE' });
    });
  });
});

self.addEventListener('offline', () => {
  console.log('[Service Worker] Network is offline');
  // Notify clients that we're offline
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'NETWORK_OFFLINE' });
    });
  });
});

// Periodic background sync (for daily reminders)
self.addEventListener('periodicsync', event => {
  console.log('[Service Worker] Periodic sync:', event.tag);
  
  if (event.tag === 'daily-reminder') {
    event.waitUntil(
      self.registration.showNotification('Daily Reminder', {
        body: 'Don\'t forget to complete your daily spiritual tasks!',
        icon: '/icons/cross.svg',
        badge: '/icons/cross.svg',
        tag: 'daily-reminder',
        requireInteraction: true,
        data: {
          url: '/'
        }
      })
    );
  }
});

// Version check and update
self.addEventListener('message', event => {
  if (event.data.type === 'CHECK_VERSION') {
    const currentVersion = CACHE_NAME.split('-v')[1];
    event.source.postMessage({
      type: 'VERSION_INFO',
      version: currentVersion,
      cacheName: CACHE_NAME
    });
  }
});

// Cache strategies for different asset types
const cacheStrategies = {
  // For fonts and external resources - cache first
  external: async (request) => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    
    try {
      const response = await fetch(request);
      if (response.ok) {
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      return new Response('Resource not available offline', {
        status: 503,
        statusText: 'Service Unavailable'
      });
    }
  },
  
  // For API requests - network first
  api: async (request) => {
    try {
      const response = await fetch(request);
      return response;
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'You are offline. Please connect to the internet to sync data.'
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },
  
  // For static assets - cache first with network fallback
  static: async (request) => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    
    try {
      const response = await fetch(request);
      if (response.ok) {
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      return new Response('Page not available offline', {
        status: 404,
        statusText: 'Not Found'
      });
    }
  }
};

// Error logging for debugging
self.addEventListener('error', event => {
  console.error('[Service Worker] Error:', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('[Service Worker] Unhandled rejection:', event.reason);
});
