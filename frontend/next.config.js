/** @type {import('next').NextConfig} */
// Local / CI default. GitHub Pages deploy copies next.config.export.js over this file.
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  // Required for Firebase Auth popups (linkWithPopup / signInWithPopup).
  // Without this, Chrome logs: Cross-Origin-Opener-Policy would block window.closed
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
