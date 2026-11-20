import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_AUTH } from "@/lib/rate-limit"
import { consumeVerification, sendVerification } from "@/lib/email-verification"
import { logEvent } from "@/lib/event-log"
import { extractIp } from "@/lib/ban-engine"

export const dynamic = "force-dynamic"

// GET /api/auth/verify → { verified, hasPassword } for the signed-in person (drives the reminder banner)
export async function GET(req: Request) {
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const row = await db.user.findUnique({ where: { id: user.id }, select: { emailVerified: true, password: true } })
  return NextResponse.json({ verified: !!row?.emailVerified, hasPassword: !!row?.password })
}

// POST /api/auth/verify { token } → marks the address as verified (the page calls this, so link previews cannot burn the link)
// POST /api/auth/verify { resend: true } → mails a new link to the signed-in person (one per minute)
export async function POST(req: Request) {
  const blocked = applyRateLimit(req, RATE_LIMIT_AUTH)
  if (blocked) return blocked
  const body = await req.json().catch(() => ({}))

  if (body.resend === true) {
    const user = await resolveUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const row = await db.user.findUnique({ where: { id: user.id }, select: { id: true, email: true, name: true, emailVerified: true } })
    if (!row) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (row.emailVerified) return NextResponse.json({ ok: true, alreadyVerified: true })
    const sent = await sendVerification(row)
    if (!sent) return NextResponse.json({ error: "Az önce bir bağlantı gönderdik. Bir dakika sonra tekrar dene.", code: "COOLDOWN" }, { status: 429 })
    return NextResponse.json({ ok: true })
  }

  const token = typeof body.token === "string" ? body.token : ""
  const userId = await consumeVerification(token)
  if (!userId) return NextResponse.json({ error: "Bu bağlantı geçersiz ya da süresi dolmuş. Panelden yeni bir bağlantı isteyebilirsin.", code: "TOKEN_INVALID" }, { status: 400 })
  await logEvent({ type: "SECURITY", message: "E-posta adresi doğrulandı", userId, ip: extractIp(req) })
  return NextResponse.json({ ok: true })
}
