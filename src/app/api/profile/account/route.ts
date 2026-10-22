import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { resolveUser } from "@/lib/auth-utils"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_AUTH } from "@/lib/rate-limit"
import { anonymizeUser, deletionBlockers, DELETE_PHRASE } from "@/lib/account"
import { logEvent } from "@/lib/event-log"
import { extractIp } from "@/lib/ban-engine"

export const dynamic = "force-dynamic"

// GET /api/profile/account → { blockers: string[], needsPassword } what stands in the way of closing the account
export async function GET(req: Request) {
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const row = await db.user.findUnique({ where: { id: user.id }, select: { password: true } })
  return NextResponse.json({ blockers: await deletionBlockers(user.id), needsPassword: !!row?.password, phrase: DELETE_PHRASE })
}

// DELETE /api/profile/account { confirm, password? } → anonymises and closes the account
export async function DELETE(req: Request) {
  const blocked = applyRateLimit(req, RATE_LIMIT_AUTH)
  if (blocked) return blocked
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  if (body.confirm !== DELETE_PHRASE) return NextResponse.json({ error: `Onaylamak için "${DELETE_PHRASE}" yaz.`, code: "CONFIRM_REQUIRED" }, { status: 400 })

  const row = await db.user.findUnique({ where: { id: user.id }, select: { password: true, role: true } })
  if (!row) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (row.role === "ADMIN") return NextResponse.json({ error: "Yönetici hesabı buradan silinemez.", code: "ADMIN" }, { status: 403 })
  if (row.password) {
    const ok = typeof body.password === "string" && (await bcrypt.compare(body.password, row.password))
    if (!ok) return NextResponse.json({ error: "Şifren yanlış.", code: "WRONG_PASSWORD" }, { status: 403 })
  }
  const blockers = await deletionBlockers(user.id)
  if (blockers.length) return NextResponse.json({ error: "Hesabın şu an kapatılamıyor.", code: "BLOCKED", blockers }, { status: 409 })

  await anonymizeUser(user.id)
  await logEvent({ type: "SECURITY", level: "warn", message: "Hesap kullanıcı tarafından silindi", userId: user.id, ip: extractIp(req) })
  return NextResponse.json({ ok: true })
}
