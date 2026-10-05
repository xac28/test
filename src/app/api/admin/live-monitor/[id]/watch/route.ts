import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-api"
import { createLiveKitToken } from "@/lib/livekit"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_WRITE } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

// POST /api/admin/live-monitor/:id/watch → a hidden, subscribe-only token: the official sees and hears the broadcast
// without showing up in the participant list or the viewer count. Every session is written to the audit log.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const blocked = applyRateLimit(req, RATE_LIMIT_WRITE)
  if (blocked) return blocked
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const room = await db.liveRoom.findUnique({
    where: { id: params.id },
    include: { teacher: { include: { user: { select: { id: true, name: true, image: true } } } } },
  })
  if (!room || !room.isActive) return NextResponse.json({ error: "Yayın bulunamadı veya sona erdi", code: "ENDED" }, { status: 404 })

  const token = await createLiveKitToken(room.roomName, `Yetkili · ${g.admin.name || "Yönetici"}`, false, {
    identity: `staff-${g.admin.id}`,
    canPublish: false,
    canPublishData: true, // staff notices and chat messages
    hidden: true,
    ttl: "2h",
    metadata: JSON.stringify({ role: "staff" }),
  })

  // one audit line per admin and broadcast per 10 minutes (a reconnect is not a new session)
  const recent = await db.auditLog.findFirst({ where: { actorId: g.admin.id, action: "WATCH_LIVE", targetId: room.id, createdAt: { gt: new Date(Date.now() - 10 * 60_000) } } })
  if (!recent) await db.auditLog.create({ data: { actorId: g.admin.id, action: "WATCH_LIVE", targetId: room.id, reason: `Canlı izlendi: ${room.title}${room.supervised ? " (denetimli yayın)" : ""}` } })

  return NextResponse.json({
    roomUrl: process.env.LIVEKIT_URL || "ws://localhost:7880",
    roomName: room.roomName,
    token,
    role: "staff",
    stream: {
      id: room.id,
      title: room.title,
      startedAt: room.createdAt,
      supervised: room.supervised,
      hostIdentity: room.teacher.user.id,
      teacher: { id: room.teacher.user.id, profileId: room.teacher.id, name: room.teacher.user.name, image: room.teacher.user.image, trial: room.teacher.isTrialMode },
    },
  })
}
