import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `npm run dev` only sends its scripts to localhost unless told otherwise, so
  // another computer opening this Mac's address (http://10.x.x.x:3060) got pages
  // that never came alive. Allow the school's private network. Has no effect on
  // `next start`, which the launchers use on the server.
  allowedDevOrigins: ["10.*.*.*", "172.*.*.*", "192.168.*.*", "*.local"],
};

export default nextConfig;
