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
  env: {
    NEXT_PUBLIC_BASE_PATH: "/TheCEOCompass",
  },
}

module.exports = nextConfig