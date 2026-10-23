import type { NextConfig } from "next";

import { buildCsp } from "./lib/security/csp";

const isDev = process.env.NODE_ENV === "development";

const baseHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // cacheComponents is deliberately off: almost every app route is per-tenant
  // and dynamic, and Lite mode is decided server-side in the root layout from
  // cookies/headers (see docs/DECISIONS.md D-005).
  poweredByHeader: false,
  env: {
    // Netlify sets CONTEXT at build time: production | deploy-preview | branch-deploy | dev.
    NEXT_PUBLIC_APP_ENV: process.env.CONTEXT ?? (isDev ? "development" : "local"),
  },
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
        // Everything except the embeddable public forms: never framed.
        source: "/((?!f/).*)",
        headers: [
          ...baseHeaders,
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: buildCsp({ frameAncestors: "'none'", isDev }) },
        ],
      },
      {
        // Hosted lead forms /f/[slug] are designed to be embedded on customers' sites.
        source: "/f/:path*",
        headers: [
          ...baseHeaders,
          { key: "Content-Security-Policy", value: buildCsp({ frameAncestors: "*", isDev }) },
        ],
      },
    ];
  },
};

export default nextConfig;
