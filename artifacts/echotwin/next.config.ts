import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "*.replit.dev",
    "*.worf.replit.dev",
    "*.repl.co",
    "*",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
      allowedOrigins: [
        "*.replit.dev",
        "*.worf.replit.dev",
        "*.repl.co",
      ],
    },
  },
};

export default nextConfig;
