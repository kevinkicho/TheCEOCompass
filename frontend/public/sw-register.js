(function () {
  if (!("serviceWorker" in navigator)) return

  // Skip in dev — SW caching conflicts with Next.js HMR
  if (
    window.location.hostname.includes("localhost") ||
    window.location.hostname.includes("127.0.0.1")
  ) {
    return
  }

  var basePath = window.__NEXT_DATA__?.basePath || ""
  // Fallback: detect basePath from page URL (e.g. /TheCEOCompass/frameworks/ → /TheCEOCompass)
  if (!basePath) {
    var m = location.pathname.match(/^\/[^/]+\//)
    if (m && m[0] !== "/_next/") basePath = m[0].replace(/\/$/, "")
  }

  /**
   * Cache-bust query so browsers fetch a fresh sw.js after deploy.
   * Keep in sync with CACHE_VERSION in sw.js when bumping.
   */
  var SW_VERSION = "v2-2026-07"
  var swPath = basePath + "/sw.js?v=" + encodeURIComponent(SW_VERSION)

  window.addEventListener("load", function () {
    navigator.serviceWorker
      .register(swPath, { scope: basePath + "/" })
      .then(function (reg) {
        // Proactively check for updates (GitHub Pages has no push SW updates)
        setInterval(function () {
          reg.update()
        }, 60000)

        // When a new SW takes control, soft-reload once so users get fresh HTML/JS
        var refreshing = false
        navigator.serviceWorker.addEventListener("controllerchange", function () {
          if (refreshing) return
          refreshing = true
          // Avoid infinite reload loops: only if we already had a controller
          if (navigator.serviceWorker.controller) {
            window.location.reload()
          }
        })
      })
      .catch(function (err) {
        console.warn("SW registration failed:", err)
      })
  })
})()
