import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  basePath: '/pixel-vault', // GitHub Pages의 하위 경로에 맞춤
  assetPrefix: '/pixel-vault/',
};

export default nextConfig;