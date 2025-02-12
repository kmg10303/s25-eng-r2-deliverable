/** @type {import('next').NextConfig} */

await import("./env.mjs");

const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  eslint: {
    // Ignores ESLint during production builds and during `next build`
    ignoreDuringBuilds: true,
  },
};
export default nextConfig;
