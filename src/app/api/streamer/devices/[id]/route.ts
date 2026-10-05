import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { logEvent } from "@/lib/event-log"
import { extractIp } from "@/lib/ban-engine"

export const dynamic = "force-dynamic"

// DELETE /api/streamer/devices/:id → the app loses access at once (its next request is refused)
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const r = await db.streamerDevice.updateMany({ where: { id: params.id, userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } })
  if (r.count !== 1) return NextResponse.json({ error: "Cihaz bulunamadı" }, { status: 404 })
  await logEvent({ type: "SECURITY", message: "Yayın uygulaması cihazı kaldırıldı", userId: user.id, ip: extractIp(req), meta: { deviceId: params.id } })
  return NextResponse.json({ ok: true })
}
