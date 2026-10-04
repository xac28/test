import NextAuth from "next-auth"
import authConfig from "./src/auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

/**
 * Pages a signed-in user may open before accepting the terms. Everything else
 * redirects to /accept-terms (the "terms gate"). API routes are not redirected —
 * they answer 403 TERMS_REQUIRED themselves (see termsGate in src/lib/terms.ts).
 */
const TERMS_GATE_EXEMPT = ["/accept-terms", "/terms", "/privacy", "/login", "/auth-error", "/api"]

/**
 * 🛡️ Namaste Middleware
 * 
 * Katmanlı güvenlik:
 * 1. Auth/login/register API'lerde IP ban kontrolü (Edge-level)
 * 2. Sayfa route koruması (role-based)
 * 3. Güvenlik header'ları (HSTS, CSP, X-Frame-Options)
 * 4. CORS koruması (origin-based, wildcard yok)
 * 
 * NOT: Edge Runtime'da Prisma çalışmaz. IP ban kontrolü
 * auth/register API route'larında (Node.js runtime) yapılır.
 * Middleware sadece sayfa route koruması ve güvenlik header'ları ekler.
 */
export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl

  const isProtectedRoute = ["/dashboard", "/teach", "/admin", "/room", "/live", "/messages", "/accept-terms"].some((p) => pathname === p || pathname.startsWith(p + "/"))

  if (isProtectedRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL("/", req.nextUrl))
  }

  // Terms gate: signed in, but the current terms were not accepted yet
  if (
    isLoggedIn &&
    req.auth?.user?.termsAccepted === false &&
    !TERMS_GATE_EXEMPT.some((p) => pathname === p || pathname.startsWith(p + "/"))
  ) {
    const url = new URL("/accept-terms", req.nextUrl)
    url.searchParams.set("next", pathname + req.nextUrl.search)
    return NextResponse.redirect(url)
  }

  // Basic Role Based Protection
  const isTeachArea = pathname === "/teach" || pathname.startsWith("/teach/")
  if (isTeachArea && req.auth?.user?.role !== "TEACHER" && req.auth?.user?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl))
  }
  
  if (pathname.startsWith("/admin") && req.auth?.user?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl))
  }

  const response = NextResponse.next()

  // ── Security Headers ──────────────────────────────────────────────────
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  )

  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://sandbox-api.iyzipay.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.googleusercontent.com https://lh3.googleusercontent.com https://images.unsplash.com https://i.pravatar.cc",
      "media-src 'self' blob: data:",
      "worker-src 'self' blob:",
      "connect-src 'self' https://api.stripe.com https://sandbox-api.iyzipay.com wss: ws:",
      "frame-src 'self' https://js.stripe.com https://sandbox-merchant.iyzipay.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  )

  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-XSS-Protection", "1; mode=block")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("Permissions-Policy", "camera=(self), microphone=(self), display-capture=(self), fullscreen=(self), geolocation=()")

  // ── CORS — sadece bilinen origin'lere izin ver ──
  const allowedOrigins = [
    process.env.NEXTAUTH_URL,
    "http://localhost:3000",
    "http://localhost:8081", // Expo mobile
  ].filter(Boolean) as string[]

  const origin = req.headers.get("origin")
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin)
    response.headers.set("Access-Control-Allow-Credentials", "true")
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
  }

  return response
})

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)"
  ],
}
