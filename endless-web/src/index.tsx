/**
 * Entry point.
 *
 * In public demo mode (REACT_APP_DEMO_ONLY=true) we first force-wipe any
 * pre-existing client state — IndexedDB, localStorage, sessionStorage,
 * Cache Storage, registered service workers — so that a browser which
 * previously visited this origin as a real (authenticated) Endless
 * deployment cannot see its own historic data anymore. Only after that
 * do we dynamically import the rest of the app. The static import graph
 * would otherwise hoist `1-app/index.tsx` (which touches the store /
 * localStorage on first evaluation) above any wipe logic.
 */

const DEMO_ONLY = import.meta.env.REACT_APP_DEMO_ONLY === 'true'
const WIPED_MARKER = 'endless_demo_wiped_v1'

async function wipeAllClientStorage() {
  // 1) Unregister every service worker registered for this origin.
  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
    } catch {}
  }

  // 2) Delete every IndexedDB database the browser has for this origin.
  if ('databases' in indexedDB) {
    try {
      const dbs = await (indexedDB as any).databases()
      await Promise.all(
        dbs
          .filter((db: { name?: string }) => !!db.name)
          .map(
            (db: { name: string }) =>
              new Promise<void>(resolve => {
                const req = indexedDB.deleteDatabase(db.name)
                req.onsuccess = req.onerror = req.onblocked = () => resolve()
              })
          )
      )
    } catch {}
  } else {
    // Safari fallback — enumerate known database names explicitly.
    const idb = window.indexedDB
    for (const name of ['endless_data', 'keyval-store']) {
      try {
        idb.deleteDatabase(name)
      } catch {}
    }
  }

  // 3) Drop every entry in Cache Storage (Workbox precache lives here).
  if ('caches' in window) {
    try {
      const names = await caches.keys()
      await Promise.all(names.map(n => caches.delete(n)))
    } catch {}
  }

  // 4) Wipe Web Storage.
  try {
    localStorage.clear()
  } catch {}
  try {
    sessionStorage.clear()
  } catch {}
}

async function boot() {
  if (DEMO_ONLY && !sessionStorage.getItem(WIPED_MARKER)) {
    await wipeAllClientStorage()
    // Reset marker after sessionStorage.clear() above. Marker stays across reloads
    // within the same tab, so we only wipe once per session.
    sessionStorage.setItem(WIPED_MARKER, '1')
    // Hard reload so nothing that might have touched localStorage / the old SW
    // during this tick can survive.
    window.location.reload()
    // Block forever so the normal boot path below never runs.
    await new Promise(() => {})
    return
  }

  // Dynamically import the rest only after the wipe check has passed —
  // a static import would hoist and defeat the wipe.
  await import('6-shared/localization')
  const [React, { createRoot }, { MainApp }] = await Promise.all([
    import('react'),
    import('react-dom/client'),
    import('1-app'),
  ])

  const container = document.getElementById('root')
  if (!container) throw new Error('No root container')
  createRoot(container).render(React.createElement(MainApp))
}

boot()
