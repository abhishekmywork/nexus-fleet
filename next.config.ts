import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["192.168.50.71", "10.118.221.120"],
};

export default nextConfig;
