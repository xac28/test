import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { endLiveRoom } from "@/lib/live-rooms"
import { requireAdmin, cleanReason } from "@/lib/admin-api"

// POST /api/admin/live-rooms/:id/close { reason? } — force-end a broadcast
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await requireAdmin(req)
    if ("response" in g) return g.response

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const existing = await db.liveRoom.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Oda bulunamadı" }, { status: 404 })

    // Marks it ended AND disconnects everybody still in the LiveKit room
    if (existing.isActive) await endLiveRoom(id)
    await db.auditLog.create({ data: { actorId: g.admin.id, action: "CLOSE_ROOM", targetId: id, reason: cleanReason(body.reason) || `Yönetici panelinden kapatıldı: ${existing.title}` } })
    const room = await db.liveRoom.findUnique({ where: { id } })

    return NextResponse.json({ success: true, room })
  } catch (error: any) {
    console.error("[ROOM_CLOSE_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}
