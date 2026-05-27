import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    domains: ["api.dicebear.com", "lh3.googleusercontent.com"],
  },
};

export default nextConfig;
