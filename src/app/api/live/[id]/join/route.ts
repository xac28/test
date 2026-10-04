import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { termsGate } from "@/lib/terms"
import { createLiveKitToken } from "@/lib/livekit"

// POST /api/live/:id/join — watch a broadcast: subscribe-only token (+ data for chat)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await resolveUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const termsBlock = termsGate(user)
    if (termsBlock) return termsBlock

    const room = await db.liveRoom.findUnique({
      where: { id: params.id },
      include: { teacher: { include: { user: { select: { id: true, name: true, image: true } } } } },
    })
    if (!room || !room.isActive) {
      return NextResponse.json({ error: "Yayın bulunamadı veya sona erdi", code: "ENDED" }, { status: 404 })
    }

    const isHost = room.teacher.userId === user.id
    const token = await createLiveKitToken(room.roomName, user.name || "İzleyici", isHost, {
      identity: user.id,
      canPublish: isHost,
      canPublishData: true,
      metadata: JSON.stringify({ role: isHost ? "host" : "viewer" }),
    })

    return NextResponse.json({
      roomUrl: process.env.LIVEKIT_URL || "ws://localhost:7880",
      roomName: room.roomName,
      token,
      role: isHost ? "host" : "viewer",
      stream: {
        id: room.id,
        title: room.title,
        startedAt: room.createdAt,
        hostIdentity: room.teacher.user.id,
        teacher: { id: room.teacher.id, name: room.teacher.user.name, image: room.teacher.user.image },
      },
    })
  } catch (error) {
    console.error("[LIVE_JOIN_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
