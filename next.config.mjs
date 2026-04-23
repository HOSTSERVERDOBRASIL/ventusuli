/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    instrumentationHook: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  eslint: {
    // CI runs lint explicitly; build should not fail production deploy because of lint backlog.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
