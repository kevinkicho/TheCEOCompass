// Used only for GitHub Pages deployment
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  distDir: "out",
  basePath: "/TheCEOCompass",
  assetPrefix: "/TheCEOCompass",
  trailingSlash: true,
  images: { unoptimized: true },
}

module.exports = nextConfig