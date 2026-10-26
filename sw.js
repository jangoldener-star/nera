/*
 * Nera service worker (prototype).
 * Caches only the static app shell so the app opens offline. It never caches
 * API responses, chat media or anything else that may be private.
 * Works at the site root and under a sub-path (e.g. GitHub Pages /nera/).
 */
const CACHE = 'nera-shell-v2'
const BASE = new URL(self.registration.scope).pathname
const SHELL = [BASE, `${BASE}manifest.webmanifest`, `${BASE}icons/icon.svg`, `${BASE}icons/icon-192.png`]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return
  // App navigations: network first, fall back to the cached shell offline.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(BASE)))
    return
  }
  // Hashed build assets are immutable: cache first.
  if (url.pathname.startsWith(`${BASE}assets/`) || url.pathname.startsWith(`${BASE}icons/`)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(CACHE).then((c) => c.put(req, copy))
            }
            return res
          }),
      ),
    )
  }
})
