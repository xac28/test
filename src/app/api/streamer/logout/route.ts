import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { hashSecret } from "@/lib/streamer"
import { logEvent } from "@/lib/event-log"
import { extractIp } from "@/lib/ban-engine"

export const dynamic = "force-dynamic"

// POST /api/streamer/logout (Bearer = the app's device token) → this app instance is signed out for good
export async function POST(req: Request) {
  const h = req.headers.get("authorization") || ""
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : ""
  if (!token.startsWith("ayas_") || token.length > 100) return NextResponse.json({ error: "Geçersiz yayın uygulaması anahtarı." }, { status: 401 })
  const device = await db.streamerDevice.findUnique({ where: { tokenHash: hashSecret(token) } })
  if (device && !device.revokedAt) {
    await db.streamerDevice.update({ where: { id: device.id }, data: { revokedAt: new Date() } })
    await logEvent({ type: "SECURITY", message: "Yayın uygulaması çıkış yaptı", userId: device.userId, ip: extractIp(req), meta: { deviceId: device.id } })
  }
  return NextResponse.json({ ok: true }) // answering the same for unknown tokens: nothing to learn here
}
