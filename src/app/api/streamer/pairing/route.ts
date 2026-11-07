import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_AUTH } from "@/lib/rate-limit"
import { hashSecret, MAX_DEVICES, MAX_OPEN_CODES, newPairCode, PAIR_TTL_MS, streamerEligibility } from "@/lib/streamer"
import { logEvent } from "@/lib/event-log"
import { extractIp } from "@/lib/ban-engine"

export const dynamic = "force-dynamic"

// POST /api/streamer/pairing → { code, expiresAt }: a short single-use code the teacher types into the desktop app
export async function POST(req: Request) {
  const blocked = applyRateLimit(req, RATE_LIMIT_AUTH)
  if (blocked) return blocked
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const el = await streamerEligibility(user.id)
  if (!el.ok) return NextResponse.json({ error: el.message, code: el.reason }, { status: 403 })

  const devices = await db.streamerDevice.count({ where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } } })
  if (devices >= MAX_DEVICES) return NextResponse.json({ error: `En fazla ${MAX_DEVICES} cihaz bağlayabilirsin. Önce kullanmadığın bir cihazı kaldır.`, code: "TOO_MANY_DEVICES" }, { status: 409 })

  // old unused codes die: at most a few are open at any time
  const open = await db.streamerPairing.findMany({ where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, select: { id: true } })
  const stale = open.slice(MAX_OPEN_CODES - 1).map((o) => o.id)
  if (stale.length) await db.streamerPairing.deleteMany({ where: { id: { in: stale } } })

  const code = newPairCode()
  const row = await db.streamerPairing.create({ data: { userId: user.id, codeHash: hashSecret(code), expiresAt: new Date(Date.now() + PAIR_TTL_MS) } })
  await logEvent({ type: "SECURITY", message: "Yayın uygulaması için eşleştirme kodu oluşturuldu", userId: user.id, ip: extractIp(req) })
  return NextResponse.json({ code, expiresAt: row.expiresAt })
}
