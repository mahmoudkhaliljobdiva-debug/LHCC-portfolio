import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // Auth actions receive passwords; do not log server-function arguments in dev.
  logging: { serverFunctions: false },
};

export default nextConfig;
