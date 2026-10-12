import type { NextConfig } from "next";

const config: NextConfig = {
  webpack: (cfg, { isServer }) => {
    // Anchor and web3.js reference node built-ins they never use in the browser.
    if (!isServer) cfg.resolve.fallback = { ...cfg.resolve.fallback, fs: false, os: false, path: false, crypto: false };
    return cfg;
  },
};

export default config;
