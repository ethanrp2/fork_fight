import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let the dev server accept requests from your phone's IP
  allowedDevOrigins: ["10.183.0.160"],

  // (optional) add others you use in dev:
  // allowedDevOrigins: ["10.183.0.160", "localhost", "127.0.0.1"],

  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3845',
        pathname: '/assets/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '3845',
        pathname: '/assets/**',
      },
      {
        protocol: 'https',
        hostname: 'sgirhsrhfsaythxkuwis.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;

