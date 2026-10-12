import type { NextConfig } from "next";

// Served at chainwrit.com/app: the landing-page project rewrites /app/* here.
export const BASE_PATH = "/app";

const config: NextConfig = {
  basePath: BASE_PATH,
  env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH },
  async redirects() {
    return [{ source: "/", destination: BASE_PATH, basePath: false, permanent: false }];
  },
  webpack: (cfg, { isServer }) => {
    // Anchor and web3.js reference node built-ins they never use in the browser.
    if (!isServer) cfg.resolve.fallback = { ...cfg.resolve.fallback, fs: false, os: false, path: false, crypto: false };
    return cfg;
  },
};

export default config;
