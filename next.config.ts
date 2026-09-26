import type { NextConfig } from 'next'

/**
 * M0-T01 — baseline Next.js configuration.
 *
 * The frozen architecture requires ONE web application that also serves the
 * versioned REST boundary at /api/v1 (see docs/architecture/01_SYSTEM_ARCHITECTURE_v1.0.md).
 * Route groups and API handlers are added by later M0 tasks; this file only
 * establishes the build.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /**
   * SEC-OBS-01: the magic-link callback URL carries the one-time token, and
   * its HTML loads same-origin CSS/JS before the page's <meta name="referrer">
   * is parsed. The HTTP header applies from the first byte, so no subresource
   * request carries the token-bearing URL as Referer. Scoped to the callback
   * route only; no other page's referrer behaviour changes.
   */
  async headers() {
    return [
      {
        source: '/auth/callback',
        headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
      },
    ]
  },
}

export default nextConfig
