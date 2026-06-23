(function () {
  if (!("serviceWorker" in navigator)) return

  // Skip in dev — SW caching conflicts with Next.js HMR
  if (window.location.hostname.includes("localhost") || window.location.hostname.includes("127.0.0.1")) return

  var basePath = window.__NEXT_DATA__?.basePath || ""
  var swPath = basePath + "/sw.js"

  window.addEventListener("load", function () {
    navigator.serviceWorker.register(swPath, { scope: basePath + "/" }).then(function (reg) {
      // Check for SW updates every 60 seconds
      setInterval(function () { reg.update() }, 60000)
    }).catch(function (err) {
      console.warn("SW registration failed:", err)
    })
  })
})()
