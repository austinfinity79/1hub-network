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
}

export default nextConfig
