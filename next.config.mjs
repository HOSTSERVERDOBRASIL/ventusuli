/** @type {import('next').RemotePattern[]} */
const imageRemotePatterns = [
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.NEXTAUTH_URL,
  process.env.STORAGE_PUBLIC_BASE_URL,
  process.env.STORAGE_ENDPOINT,
]
  .filter(Boolean)
  .flatMap((value) => {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return [];
      return [
        {
          protocol: parsed.protocol.replace(":", ""),
          hostname: parsed.hostname,
          port: parsed.port,
          pathname: "/**",
        },
      ];
    } catch {
      return [];
    }
  })
  .filter(
    (pattern, index, patterns) =>
      patterns.findIndex(
        (item) =>
          item.protocol === pattern.protocol &&
          item.hostname === pattern.hostname &&
          item.port === pattern.port,
      ) === index,
  );

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    instrumentationHook: true,
  },
  images: {
    remotePatterns: imageRemotePatterns,
  },
};

export default nextConfig;