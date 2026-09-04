import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/magic-of-seven",
  assetPrefix: "/magic-of-seven/",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;