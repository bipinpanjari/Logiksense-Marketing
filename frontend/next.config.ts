import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, "..", ".."),
  ...(process.env.IS_ELECTRON_BUILD === 'true' ? { output: 'export' } : {}),
};

export default nextConfig;

