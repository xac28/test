// Content-Security-Policy. CSP_MODE (read at build time): "report-only" (default: violations are logged by /api/csp-report, nothing is
// blocked), "enforce" or "off". Switch to "enforce" once the log of a real deployment is clean.
const isDev = process.env.NODE_ENV !== 'production'
const cspMode = process.env.CSP_MODE || 'report-only'
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://js.stripe.com${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' blob: data: https: wss: ws:",
  "frame-src https://js.stripe.com https://hooks.stripe.com https://*.iyzipay.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https:",
  "frame-ancestors 'self'",
  'report-uri /api/csp-report',
].join('; ')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'i.pravatar.cc' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }, // Google profile avatars
      { protocol: 'http', hostname: '5.63.21.194' },
    ],
    minimumCacheTTL: 60,
  },

  experimental: {
    optimizeCss: false,
    serverComponentsExternalPackages: ['iyzipay'],
  },

  async redirects() {
    // legacy links used `/room/trial-<teacherId>`
    return [{ source: '/room/trial-:id', destination: '/room/trial/:id', permanent: false }]
  },

  async headers() {
    return [
      // ── CORS for Mobile API ──────────────────────────────────────────
      // Allow mobile apps (Expo, React Native) to access API endpoints
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Requested-With' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
      // ── Security headers for web pages ────────────────────────────────
      {
        source: '/((?!api).*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          // HSTS only where the site is served over HTTPS: set ENABLE_HSTS=true when building for production behind TLS
          ...(process.env.ENABLE_HSTS === 'true' ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }] : []),
          ...(cspMode === 'off' ? [] : [{ key: cspMode === 'enforce' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only', value: csp }]),
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=self, microphone=self, geolocation=()'
          }
        ],
      },
    ]
  },
};

module.exports = nextConfig;
