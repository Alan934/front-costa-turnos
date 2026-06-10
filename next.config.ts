import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Avatares/branding de profesionales servidos por el back o storage firmado.
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
