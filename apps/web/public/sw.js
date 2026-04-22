// Tombstone service worker. If the browser has an old Code.ae SW registered,
// fetching this URL replaces it with this one, which immediately unregisters
// itself and clears every cached response before reloading open clients.
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
        await self.registration.unregister();
        const clients = await self.clients.matchAll({ type: 'window' });
        for (const client of clients) {
          // Force a full, un-cached reload so the new server bundles load cleanly.
          client.navigate(client.url);
        }
      } catch {
        /* no-op */
      }
    })(),
  );
});
