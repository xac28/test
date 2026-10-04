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
          // HSTS disabled for HTTP VDS testing
          // {
          //   key: 'Strict-Transport-Security',
          //   value: 'max-age=63072000; includeSubDomains; preload'
          // },
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
