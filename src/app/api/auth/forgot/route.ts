import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_AUTH } from "@/lib/rate-limit"
import { isValidEmail, normalizeEmail } from "@/lib/auth-utils"
import { extractIp } from "@/lib/ban-engine"
import { sendEmail } from "@/lib/email"
import { logEvent } from "@/lib/event-log"
import { hashToken, newToken, resetEmail, resetLink, RESET_COOLDOWN_MS, RESET_TTL_MS } from "@/lib/password-reset"

export const dynamic = "force-dynamic"

// POST /api/auth/forgot { email } → always { ok: true }: the answer must not reveal whether the address has an account
export async function POST(req: Request) {
  const blocked = applyRateLimit(req, RATE_LIMIT_AUTH)
  if (blocked) return blocked
  const body = await req.json().catch(() => ({}))
  const raw = typeof body.email === "string" ? body.email : ""
  if (!raw || raw.length > 200 || !isValidEmail(raw)) return NextResponse.json({ error: "Geçerli bir e-posta adresi gir." }, { status: 400 })
  const email = normalizeEmail(raw)
  const ip = extractIp(req)

  try {
    const user = await db.user.findUnique({ where: { email }, select: { id: true, name: true, banned: true } })
    if (user && !user.banned) {
      const recent = await db.passwordResetToken.findFirst({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - RESET_COOLDOWN_MS) } }, select: { id: true } })
      if (!recent) {
        const token = newToken()
        await db.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MS), ip } })
        const link = resetLink(token)
        const mail = resetEmail(user.name, link)
        const sent = await sendEmail({ to: email, subject: mail.subject, text: mail.text, html: mail.html })
        await logEvent({ type: "SECURITY", message: `Şifre sıfırlama bağlantısı istendi${sent.success ? "" : " (e-posta gönderilemedi)"}`, userId: user.id, ip })
        // without SMTP (development) the link is only printed to the server console, never stored or returned
        if (!sent.success && process.env.NODE_ENV !== "production") console.warn(`[PASSWORD_RESET] ${email}: ${link}`)
      }
    } else {
      await logEvent({ type: "SECURITY", level: "info", message: "Şifre sıfırlama istendi: kayıtlı olmayan adres", ip })
    }
  } catch (error) {
    console.error("[FORGOT_ERROR]", error)
  }
  return NextResponse.json({ ok: true })
}
