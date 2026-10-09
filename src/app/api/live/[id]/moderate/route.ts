import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { livekitRoomService } from "@/lib/livekit"
import { parseRoomSettings, serializeRoomSettings, SLOW_MODE_OPTIONS } from "@/lib/live-chat"

// POST /api/live/:id/moderate  { action: "chat-settings", chatEnabled?, slowModeSec? } | { action: "kick", identity }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await resolveUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const room = await db.liveRoom.findUnique({ where: { id: params.id }, include: { teacher: true } })
    if (!room || !room.isActive) return NextResponse.json({ error: "Yayın bulunamadı" }, { status: 404 })
    if (room.teacher.userId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Yalnızca yayıncı yönetebilir" }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const svc = livekitRoomService()

    if (body.action === "chat-settings") {
      const [lk] = await svc.listRooms([room.roomName])
      const current = parseRoomSettings(lk?.metadata)
      const next = {
        ...current,
        ...(typeof body.chatEnabled === "boolean" ? { chatEnabled: body.chatEnabled } : {}),
        ...(SLOW_MODE_OPTIONS.includes(Number(body.slowModeSec)) ? { slowModeSec: Number(body.slowModeSec) } : {}),
      }
      await svc.updateRoomMetadata(room.roomName, serializeRoomSettings(next))
      return NextResponse.json({ success: true, settings: next })
    }

    if (body.action === "kick") {
      const identity = String(body.identity || "")
      if (!identity || identity === room.teacher.userId) {
        return NextResponse.json({ error: "Geçersiz katılımcı" }, { status: 400 })
      }
      await svc.removeParticipant(room.roomName, identity)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 })
  } catch (error) {
    console.error("[LIVE_MODERATE_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
