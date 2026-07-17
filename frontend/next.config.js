/** @type {import('next').NextConfig} */
// Local / CI default. GitHub Pages deploy copies next.config.export.js over this file.
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
}

module.exports = nextConfig
