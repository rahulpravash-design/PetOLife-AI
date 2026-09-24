import type { NextConfig } from "next";

// Response headers for the JSON API. The only client is the native mobile app
// (no browser origin, so no CORS is enabled), but these still protect anyone
// who opens an endpoint in a browser and keep intermediaries from caching
// per-user health data.
const apiSecurityHeaders = [
  { key: "Cache-Control", value: "no-store" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/api/:path*", headers: apiSecurityHeaders }];
  },
};

export default nextConfig;
