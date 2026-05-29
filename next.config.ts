import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow LAN devices (phone over Wi-Fi) to load dev resources. Next.js 16
  // blocks cross-origin /_next/* requests by default, which silently breaks
  // hot-reload and dev-time API calls from anything other than localhost.
  allowedDevOrigins: [
    "192.168.1.12",
    "192.168.0.0/16",
    "10.0.0.0/8",
    "*.local",
  ],
};

export default nextConfig;
