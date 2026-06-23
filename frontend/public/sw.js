const CACHE_VERSION = "v1"
const STATIC_CACHE = `ceo-compass-static-${CACHE_VERSION}`
const FIREBASE_CACHE = `ceo-compass-firebase-${CACHE_VERSION}`
const PAGE_CACHE = `ceo-compass-pages-${CACHE_VERSION}`

const STATIC_ASSETS = [
  /\.(?:js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp|ico)$/,
  /\/_next\/static\//,
]

const FIREBASE_HOSTS = [
  "firebaseio.com",
  "googleapis.com",
]

self.addEventListener("install", (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll([]))
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !key.endsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== "GET") return

  // Skip cross-origin non-Firebase requests
  const isSameOrigin = url.origin === self.location.origin
  const isFirebase = FIREBASE_HOSTS.some((h) => url.hostname.includes(h))

  if (!isSameOrigin && !isFirebase) return

  // Firebase Auth — always network (never cache auth tokens)
  if (url.hostname.includes("securetoken.googleapis.com") || url.hostname.includes("identitytoolkit.googleapis.com")) {
    return
  }

  // Firebase RTDB reads — stale-while-revalidate
  if (isFirebase && url.hostname.includes("firebaseio.com")) {
    event.respondWith(staleWhileRevalidate(request, FIREBASE_CACHE))
    return
  }

  // Static assets (JS, CSS, fonts, images) — cache-first
  if (STATIC_ASSETS.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // HTML pages — network-first with cache fallback
  if (request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(networkFirst(request, PAGE_CACHE))
    return
  }

  // Default — try cache, fall back to network
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  )
})

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) {
    // Update cache in background
    fetch(request).then((res) => {
      if (res.ok) cache.put(request, res.clone())
    }).catch(() => {})
    return cached
  }
  const response = await fetch(request)
  if (response.ok) cache.put(request, response.clone())
  return response
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    // Offline fallback — try root page
    const rootPage = await cache.match("/")
    if (rootPage) return rootPage
    return new Response("Offline — connect to the internet and try again.", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    })
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone())
    return response
  }).catch(() => cached)
  return cached || fetchPromise
}
