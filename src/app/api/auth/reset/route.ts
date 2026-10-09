import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_AUTH } from "@/lib/rate-limit"
import { validatePassword } from "@/lib/auth-utils"
import { extractIp } from "@/lib/ban-engine"
import { logEvent } from "@/lib/event-log"
import { notify } from "@/lib/notifications"
import { hashToken } from "@/lib/password-reset"

export const dynamic = "force-dynamic"

// GET /api/auth/reset?token=… → { valid } (lets the page say "this link has expired" before the form is filled in)
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || ""
  if (token.length < 20 || token.length > 200) return NextResponse.json({ valid: false })
  const row = await db.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) }, select: { usedAt: true, expiresAt: true } })
  return NextResponse.json({ valid: !!row && !row.usedAt && row.expiresAt > new Date() })
}

// POST /api/auth/reset { token, password } → sets the new password; the link works once
export async function POST(req: Request) {
  const blocked = applyRateLimit(req, RATE_LIMIT_AUTH)
  if (blocked) return blocked
  const body = await req.json().catch(() => ({}))
  const token = typeof body.token === "string" ? body.token : ""
  const password = typeof body.password === "string" ? body.password : ""
  const check = validatePassword(password)
  if (!check.valid) return NextResponse.json({ error: check.error }, { status: 400 })

  const row = token.length >= 20 && token.length <= 200 ? await db.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } }) : null
  if (!row || row.usedAt || row.expiresAt <= new Date()) {
    return NextResponse.json({ error: "Bu bağlantı geçersiz ya da süresi dolmuş. Yeni bir sıfırlama bağlantısı iste.", code: "TOKEN_INVALID" }, { status: 400 })
  }
  // claim the link first: two requests with the same link must not both win
  const claimed = await db.passwordResetToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } })
  if (claimed.count !== 1) return NextResponse.json({ error: "Bu bağlantı zaten kullanıldı.", code: "TOKEN_INVALID" }, { status: 400 })

  const hashed = await bcrypt.hash(password, 12)
  await db.user.update({ where: { id: row.userId }, data: { password: hashed } })
  await db.passwordResetToken.deleteMany({ where: { userId: row.userId, usedAt: null } }) // any other open links die with this one
  const ip = extractIp(req)
  await logEvent({ type: "SECURITY", message: "Şifre sıfırlandı", userId: row.userId, ip })
  await notify({ userId: row.userId, type: "SYSTEM", title: "Şifren değiştirildi", body: "Şifreni sıfırladın. Bunu sen yapmadıysan hemen canlı destekle iletişime geç.", href: "/dashboard/support" }).catch(() => {})
  return NextResponse.json({ ok: true })
}
