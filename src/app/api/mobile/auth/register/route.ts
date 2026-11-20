import { logEvent } from "@/lib/event-log"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_AUTH } from "@/lib/rate-limit"
import {
  normalizeEmail,
  validatePassword,
  createMobileSession,
  sanitizeUser,
} from "@/lib/auth-utils"
import { rejectFakeEmail } from "@/lib/disposable-email"
import { checkBanEvasion, extractIp, logUserIp } from "@/lib/ban-engine"
import { termsAcceptanceData } from "@/lib/terms"

/**
 * POST /api/mobile/auth/register
 * 
 * Mobile registration endpoint. Creates user + returns Bearer token.
 * 
 * 🛡️ Ban Evasion Protection (same as web):
 * - IP ban kontrolü
 * - Banlı kullanıcı IP eşleşmesi
 * - Email alias tespiti
 * - Telefon numarası eşleşmesi
 * 
 * Account resolution:
 * - New email → creates user + session
 * - Google-only email (no password) → 409 USE_GOOGLE_OR_RESET (sign in with Google or reset the password by email)
 * - Existing email with password → error (already registered)
 */
export async function POST(req: Request) {
  const blocked = applyRateLimit(req, RATE_LIMIT_AUTH)
  if (blocked) return blocked

  try {
    const body = await req.json()
    const { name, password } = body
    const email = body.email ? normalizeEmail(body.email) : null

    // ── Validation ──────────────────────────────────────────────────────

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Ad, e-posta ve şifre gereklidir." },
        { status: 400 }
      )
    }

    // The terms box is mandatory on every client (web + mobile)
    if (body.acceptTerms !== true) {
      return NextResponse.json(
        { error: "Kayıt olmak için Kullanım, Pazaryeri ve Mesafeli Satış Sözleşmesi'ni kabul etmelisiniz.", code: "TERMS_REQUIRED" },
        { status: 400 }
      )
    }

    if (name.trim().length < 2) {
      return NextResponse.json(
        { error: "İsim en az 2 karakter olmalıdır." },
        { status: 400 }
      )
    }

    const emailProblem = rejectFakeEmail(email)
    if (emailProblem) {
      return NextResponse.json({ error: emailProblem, code: "EMAIL_REJECTED" }, { status: 400 })
    }

    const passwordCheck = validatePassword(password)
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { error: passwordCheck.error },
        { status: 400 }
      )
    }

    // ── 🛡️ Ban Evasion Check ────────────────────────────────────────────

    const ip = extractIp(req)
    const userAgent = req.headers.get("user-agent")

    const evasionCheck = await checkBanEvasion({
      ip,
      email,
      name: name.trim(),
      userAgent,
    })

    if (evasionCheck.banned) {
      console.log(`[MOBILE_REGISTER] 🚨 Ban evasion blocked: ${evasionCheck.matchType} | IP: ${ip} | Email: ${email}`)
      return NextResponse.json(
        { error: "Hesap oluşturulamıyor. Destek için iletişime geçiniz." },
        { status: 403 }
      )
    }

    // ── Account Resolution ──────────────────────────────────────────────

    const hashedPassword = await bcrypt.hash(password, 12)
    let user

    const existingUser = await db.user.findUnique({ where: { email } })

    if (existingUser) {
      // Banlı kullanıcı kontrolü
      if (existingUser.banned) {
        return NextResponse.json(
          { error: "Hesap oluşturulamıyor. Destek için iletişime geçiniz." },
          { status: 403 }
        )
      }

      if (existingUser.password) {
        // Already has credentials — block duplicate registration
        return NextResponse.json(
          { error: "Bu e-posta adresi zaten kullanılıyor." },
          { status: 409 }
        )
      }

      // Google-only account: never hand a password for it to whoever typed the address (that would be an
      // account takeover). Proving the mailbox is what "forgot password" does — same rule as the web form.
      return NextResponse.json(
        { error: "Bu e-posta adresi Google ile kayıtlı. Google ile giriş yapabilir ya da şifre belirlemek için \"Şifremi unuttum\" bağlantısını kullanabilirsin.", code: "USE_GOOGLE_OR_RESET" },
        { status: 409 }
      )
    } else {
      // Brand new user
      user = await db.user.create({
        data: {
          name: name.trim(),
          email,
          password: hashedPassword,
          role: "STUDENT",
          ...termsAcceptanceData(),
        },
      })

      logEvent({ type: "AUTH_REGISTER", message: `Yeni üye (mobil): ${email}`, userId: user.id })

      // Auto-admin check
      const adminEmail = process.env.ADMIN_EMAIL
      if (adminEmail && email === adminEmail.toLowerCase()) {
        user = await db.user.update({
          where: { id: user.id },
          data: { role: "ADMIN" },
        })
      }
    }

    // IP logla
    await logUserIp(user.id, ip, userAgent)

    // ── Create Mobile Session ───────────────────────────────────────────

    const session = await createMobileSession(user.id)

    return NextResponse.json({
      token: session.token,
      expiresAt: session.expires.toISOString(),
      linked: !!existingUser, // true if this was an account sync
      user: sanitizeUser(user),
    })
  } catch (error: any) {
    console.error("[MOBILE_REGISTER_ERROR]", error)
    return NextResponse.json(
      { error: "Bir hata oluştu. Lütfen tekrar deneyin." },
      { status: 500 }
    )
  }
}
