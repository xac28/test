import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_AUTH } from "@/lib/rate-limit"
import { normalizeEmail, isValidEmail, validatePassword } from "@/lib/auth-utils"
import { checkBanEvasion, extractIp, logUserIp } from "@/lib/ban-engine"
import { termsAcceptanceData } from "@/lib/terms"
import { logEvent } from "@/lib/event-log"
import { sendVerification } from "@/lib/email-verification"

/**
 * POST /api/auth/register
 * 
 * Web registration endpoint. Creates a User record with hashed password.
 * Does NOT create a session — the web frontend calls NextAuth signIn() 
 * immediately after to establish a cookie-based session.
 * 
 * 🛡️ Ban Evasion Protection:
 * - IP ban kontrolü
 * - Banlı kullanıcı ile aynı IP tespiti
 * - Email alias tespiti (gmail+trick)
 * - Telefon numarası eşleşmesi
 * 
 * Handles account synchronization:
 * - If email already has a credentials account → error
 * - If email exists from Google OAuth (no password) → sets password (account linking)
 * - If email is new → creates fresh user
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

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Geçerli bir e-posta adresi giriniz." },
        { status: 400 }
      )
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
      // Kullanıcıya belirsiz bir hata mesajı göster (bilgi sızdırmamak için)
      console.log(`[REGISTER] 🚨 Ban evasion blocked: ${evasionCheck.matchType} | IP: ${ip} | Email: ${email}`)
      return NextResponse.json(
        { error: "Hesap oluşturulamıyor. Destek için iletişime geçiniz." },
        { status: 403 }
      )
    }

    // ── Account Resolution ──────────────────────────────────────────────

    const existingUser = await db.user.findUnique({ where: { email } })
    const hashedPassword = await bcrypt.hash(password, 12)

    if (existingUser) {
      // Eğer kullanıcı banlıysa girişi engelle
      if (existingUser.banned) {
        return NextResponse.json(
          { error: "Hesap oluşturulamıyor. Destek için iletişime geçiniz." },
          { status: 403 }
        )
      }

      if (existingUser.password) {
        // User already has credentials — block duplicate registration
        return NextResponse.json(
          { error: "Bu e-posta adresi zaten kullanılıyor." },
          { status: 409 }
        )
      }

      // The address belongs to an account that was opened with Google and has no password. Registering must NOT hand the
      // caller a password for it (anyone could type somebody else's address): proving the mailbox is what "forgot password" does.
      return NextResponse.json(
        { error: "Bu e-posta adresi Google ile kayıtlı. Google ile giriş yapabilir ya da şifre belirlemek için \"Şifremi unuttum\" bağlantısını kullanabilirsin.", code: "USE_GOOGLE_OR_RESET" },
        { status: 409 }
      )
    }

    // ── Create New User ─────────────────────────────────────────────────

    const user = await db.user.create({
      data: {
        name: name.trim(),
        email,
        password: hashedPassword,
        role: "STUDENT",
        ...termsAcceptanceData(),
      },
    })

    // Check if this email should be auto-admin
    const adminEmail = process.env.ADMIN_EMAIL
    if (adminEmail && email === adminEmail.toLowerCase()) {
      await db.user.update({
        where: { id: user.id },
        data: { role: "ADMIN" },
      })
    }

    // IP logla (yeni kullanıcı)
    await logUserIp(user.id, ip, userAgent)
    logEvent({ type: "AUTH_REGISTER", message: `Yeni üye (web): ${email}`, userId: user.id, ip })
    sendVerification({ id: user.id, email: user.email, name: user.name }).catch(() => {}) // never blocks or fails the sign-up

    return NextResponse.json({
      success: true,
      linked: false,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
      },
    })
  } catch (error: any) {
    console.error("[WEB_REGISTER_ERROR]", error)
    return NextResponse.json(
      { error: "Bir hata oluştu. Lütfen tekrar deneyin." },
      { status: 500 }
    )
  }
}
