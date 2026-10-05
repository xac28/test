import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import authConfig from './auth.config'
import NextAuth from 'next-auth'

const { auth } = NextAuth(authConfig)

/**
 * Signed-in users who have not accepted the current terms may only open these pages;
 * everything else redirects to /accept-terms (the "terms gate"). API routes are not
 * redirected — they answer 403 TERMS_REQUIRED themselves (see termsGate in lib/terms.ts).
 */
const TERMS_GATE_EXEMPT = ['/accept-terms', '/terms', '/privacy', '/login', '/auth-error', '/api']

/** Pages that need a signed-in user. */
const PROTECTED_PREFIXES = ['/panel', '/dashboard', '/teach', '/admin', '/room', '/live', '/messages', '/accept-terms']

const inArea = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(prefix + '/')

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

  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth
  const isApi = pathname.startsWith('/api/')

  if (!isApi) {
    // 2. Pages that need a signed-in user
    if (PROTECTED_PREFIXES.some((p) => inArea(pathname, p)) && !isLoggedIn) {
      // login pages for deep links, the home page for the dashboards (as before)
      if (inArea(pathname, '/live') || inArea(pathname, '/room') || inArea(pathname, '/messages') || inArea(pathname, '/panel')) {
        const url = new URL('/login', req.nextUrl)
        url.searchParams.set('callbackUrl', pathname + req.nextUrl.search)
        return NextResponse.redirect(url)
      }
      return NextResponse.redirect(new URL('/', req.nextUrl))
    }

    // 3. Terms gate: signed in, but the current terms were not accepted yet
    // (`undefined` = a session issued before this check existed → API routes still enforce it)
    if (isLoggedIn && req.auth?.user?.termsAccepted === false && !TERMS_GATE_EXEMPT.some((p) => inArea(pathname, p))) {
      const url = new URL('/accept-terms', req.nextUrl)
      url.searchParams.set('next', pathname + req.nextUrl.search)
      return NextResponse.redirect(url)
    }

    // 4. Role areas ("/teach" must not match the public "/teachers")
    const role = req.auth?.user?.role
    if (inArea(pathname, '/teach') && role !== 'TEACHER' && role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/panel', req.nextUrl))
    }
    if (inArea(pathname, '/admin') && role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/panel', req.nextUrl))
    }
    if (pathname === '/live/studio' && role !== 'TEACHER' && role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/live', req.nextUrl))
    }
  }

  // 5. Apply security headers to web page responses
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
