import { logEvent } from "@/lib/event-log"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_AUTH } from "@/lib/rate-limit"
import {
  normalizeEmail,
  isValidEmail,
  createMobileSession,
  sanitizeUser,
  cleanupExpiredSessions,
} from "@/lib/auth-utils"
import { isIpBanned, isUserBanned, extractIp, logUserIp } from "@/lib/ban-engine"

/**
 * POST /api/mobile/auth/login
 * 
 * Mobile login endpoint. Validates credentials and returns a Bearer token.
 * 
 * 🛡️ Ban Protection:
 * - IP ban kontrolü (login öncesi)
 * - Kullanıcı ban kontrolü (banned=true)
 * - Başarılı login'de IP loglama
 * 
 * Instagram-style behavior:
 * - Multiple simultaneous sessions allowed (phone + tablet + web)
 * - Each login creates a NEW session token (doesn't invalidate others)
 * - Tokens are cryptographically random (not derived from predictable data)
 * - Expired sessions are cleaned up lazily
 * 
 * Account sync scenarios:
 * - Google-only account → instructs user to set password via register
 * - Credentials account → normal login
 * - Linked account (Google + password) → normal login with password
 */
export async function POST(req: Request) {
  const blocked = applyRateLimit(req, RATE_LIMIT_AUTH)
  if (blocked) return blocked

  try {
    const body = await req.json()
    const password = body.password
    const email = body.email ? normalizeEmail(body.email) : null

    // ── Validation ──────────────────────────────────────────────────────

    if (!email || !password) {
      return NextResponse.json(
        { error: "E-posta ve şifre gereklidir." },
        { status: 400 }
      )
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Geçerli bir e-posta adresi giriniz." },
        { status: 400 }
      )
    }

    // ── 🛡️ IP Ban Check ────────────────────────────────────────────────

    const ip = extractIp(req)
    const userAgent = req.headers.get("user-agent")

    const ipBanCheck = await isIpBanned(ip)
    if (ipBanCheck.banned) {
      console.log(`[MOBILE_LOGIN] 🚨 IP banned attempt: ${ip} | Email: ${email}`)
      return NextResponse.json(
        { error: "Giriş yapılamıyor. Destek için iletişime geçiniz." },
        { status: 403 }
      )
    }

    // ── User Lookup ─────────────────────────────────────────────────────

    const user = await db.user.findUnique({ where: { email } })

    if (!user) {
      // Constant-time response to prevent user enumeration
      return NextResponse.json(
        { error: "E-posta veya şifre hatalı." },
        { status: 401 }
      )
    }

    // 🛡️ Banned user kontrolü
    if (user.banned) {
      console.log(`[MOBILE_LOGIN] 🚨 Banned user login attempt: ${email} from IP: ${ip}`)
      return NextResponse.json(
        { error: "Hesabınız askıya alınmıştır. Destek için iletişime geçiniz." },
        { status: 403 }
      )
    }

    if (!user.password) {
      // Account exists from Google OAuth but has no password set
      return NextResponse.json(
        {
          error: "Bu hesap Google ile oluşturulmuş. Lütfen önce 'Kayıt Ol' ekranından aynı e-posta ile bir şifre belirleyin.",
          code: "NEEDS_PASSWORD_SETUP",
        },
        { status: 401 }
      )
    }

    // ── Password Verification ───────────────────────────────────────────

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      logEvent({ type: "AUTH_FAIL", level: "warn", message: `Mobil giriş başarısız (yanlış şifre): ${email}`, userId: user.id, ip })
      return NextResponse.json(
        { error: "E-posta veya şifre hatalı." },
        { status: 401 }
      )
    }

    // ── Session Creation ────────────────────────────────────────────────

    // Clean up any expired sessions for this user (housekeeping)
    cleanupExpiredSessions(user.id).catch(() => {})

    // IP logla (başarılı login)
    await logUserIp(user.id, ip, userAgent)
    logEvent({ type: "AUTH_LOGIN", message: `Mobil giriş: ${email}`, userId: user.id, ip })

    // Create new mobile session (doesn't invalidate existing sessions)
    const session = await createMobileSession(user.id)

    return NextResponse.json({
      token: session.token,
      expiresAt: session.expires.toISOString(),
      user: sanitizeUser(user),
    })
  } catch (error: any) {
    console.error("[MOBILE_LOGIN_ERROR]", error)
    return NextResponse.json(
      { error: "Bir hata oluştu. Lütfen tekrar deneyin." },
      { status: 500 }
    )
  }
}
