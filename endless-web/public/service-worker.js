// Kill-switch service worker.
// In demo mode, vite.config.ts's demo-kill-switch-sw plugin overwrites the
// Workbox-generated dist/service-worker.js with this file after the bundle
// is written.
//
// Purpose: the demo origin may host an older SW from a previous deployment
// of the authenticated app. That old SW would otherwise intercept requests
// and keep serving stale bundles containing private user data. This SW
// replaces it, purges caches, unregisters itself, and force-reloads open
// tabs so the fresh bundle's boot-time storage wipe can run with a clean
// network path.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const names = await caches.keys()
        await Promise.all(names.map((n) => caches.delete(n)))
      } catch {}
      try {
        await self.registration.unregister()
      } catch {}
      try {
        const clients = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        })
        for (const client of clients) {
          try {
            client.navigate(client.url)
          } catch {}
        }
      } catch {}
    })()
  )
})

// No fetch handler — requests go straight to the network, so the main
// bundle (with its storage wipe) actually runs on navigation.
