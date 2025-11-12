import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let the dev server accept requests from your phone's IP
  allowedDevOrigins: ["10.183.0.160"],

  // (optional) add others you use in dev:
  // allowedDevOrigins: ["10.183.0.160", "localhost", "127.0.0.1"],
};

export default nextConfig;

