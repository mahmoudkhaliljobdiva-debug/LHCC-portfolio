import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      // Deliberately scoped: does not block Next hydration, PDF workers or charts.
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
    ] }];
  },
  // Auth actions receive passwords; do not log server-function arguments in dev.
  logging: { serverFunctions: false },
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};

export default nextConfig;
