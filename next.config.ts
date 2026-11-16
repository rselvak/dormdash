import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

// Origins identify this server, not the phones/computers visiting it.
// Resolve exact private IPv4 addresses at startup instead of allowing every origin.
const localDevHosts = Object.values(networkInterfaces()).flatMap(addresses =>
  (addresses ?? []).filter(({ family, internal, address }) =>
    family === "IPv4" && !internal &&
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address),
  ).map(({ address }) => address),
);

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: localDevHosts,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
