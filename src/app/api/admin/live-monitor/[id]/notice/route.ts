import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { DataPacket_Kind } from "livekit-server-sdk"
import { requireAdmin } from "@/lib/admin-api"
import { livekitRoomService } from "@/lib/livekit"
import { notify } from "@/lib/notifications"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_WRITE } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const NOTICE_MAX = 240

// POST /api/admin/live-monitor/:id/notice { message, audience: "teacher" | "all" }
// A message from the officials: shown to the teacher on top of the studio ("teacher") or to everybody in the room ("all").
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const blocked = applyRateLimit(req, RATE_LIMIT_WRITE)
  if (blocked) return blocked
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const body = await req.json().catch(() => ({}))
  const message = typeof body.message === "string" ? body.message.trim().slice(0, NOTICE_MAX) : ""
  const audience = body.audience === "all" ? "all" : "teacher"
  if (message.length < 3) return NextResponse.json({ error: "Mesaj en az 3 karakter olmalı." }, { status: 400 })

  const room = await db.liveRoom.findUnique({ where: { id: params.id }, include: { teacher: { select: { userId: true } } } })
  if (!room || !room.isActive) return NextResponse.json({ error: "Yayın bulunamadı veya sona erdi", code: "ENDED" }, { status: 404 })

  const payload = new TextEncoder().encode(JSON.stringify({ text: message, audience, ts: Date.now() }))
  try {
    await livekitRoomService().sendData(room.roomName, payload, DataPacket_Kind.RELIABLE, {
      topic: "staff-notice",
      ...(audience === "teacher" ? { destinationIdentities: [room.teacher.userId] } : {}),
    })
  } catch (e) {
    return NextResponse.json({ error: "Mesaj yayın odasına iletilemedi.", detail: (e as Error).message }, { status: 502 })
  }
  // the teacher also finds it in the bell, in case the studio tab is not in front
  await notify({ userId: room.teacher.userId, type: "SYSTEM", title: "Yetkili mesajı", body: message, href: "/live/studio", push: true }).catch(() => {})
  await db.auditLog.create({ data: { actorId: g.admin.id, action: "LIVE_NOTICE", targetId: room.id, reason: `${audience === "all" ? "Odaya" : "Öğretmene"}: ${message}` } })
  return NextResponse.json({ success: true })
}
