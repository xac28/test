import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import authConfig from './auth.config'
import NextAuth from 'next-auth'

const { auth } = NextAuth(authConfig)

// ── CORS Preflight Handler ──────────────────────────────────────────────────
// Mobile apps (Expo/React Native) send OPTIONS preflight requests before
// making cross-origin API calls. These must be handled before any auth logic.
function handleCorsForApi(req: NextRequest): NextResponse | null {
  // Only handle API routes
  if (!req.nextUrl.pathname.startsWith('/api/')) return null

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  return null
}

// ── Main Middleware ─────────────────────────────────────────────────────────
export default auth((req) => {
  // 1. Handle CORS preflight for API routes (mobile app compatibility)
  const corsResponse = handleCorsForApi(req as unknown as NextRequest)
  if (corsResponse) return corsResponse

  // 2. Apply security headers to web page responses
  const response = NextResponse.next()

  // X-Frame-Options — Prevents clickjacking
  response.headers.set('X-Frame-Options', 'DENY')

  // X-Content-Type-Options — Prevents MIME sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')

  // Referrer-Policy — Controls referrer information
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // HSTS disabled for HTTP VDS testing on 5.63.21.194
  // response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')

  // CSP disabled for HTTP VDS testing
  // response.headers.set('Content-Security-Policy', "upgrade-insecure-requests")

  return response
})

export const config = {
  // Apply middleware to all routes including API routes (for CORS preflight)
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
