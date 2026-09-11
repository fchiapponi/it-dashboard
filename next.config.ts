import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets teammates on the LAN load the dev server directly by IP instead of
  // localhost. Not needed in production (`next start` has no such restriction).
  allowedDevOrigins: ["10.27.8.249"],
};

export default nextConfig;
