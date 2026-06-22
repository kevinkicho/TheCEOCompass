const isServer = typeof window === "undefined"

export const isStaticHosting = isServer || (
  !window.location.hostname.includes("localhost")
  && !window.location.hostname.includes("127.0.0.1")
)
