import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { termsGate } from "@/lib/terms"
import { createLiveKitToken } from "@/lib/livekit"
import { canAccessContent } from "@/lib/workshops"

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

    // Workshop sessions are for confirmed participants (and the host / admins) only
    if (room.workshopId && !isHost && user.role !== "ADMIN") {
      const enrollment = await db.workshopEnrollment.findUnique({
        where: { workshopId_userId: { workshopId: room.workshopId, userId: user.id } },
      })
      if (!canAccessContent({ isOwner: false, isAdmin: false, enrollmentStatus: enrollment?.status })) {
        const w = await db.workshop.findUnique({ where: { id: room.workshopId }, select: { slug: true, title: true } })
        return NextResponse.json(
          {
            error: enrollment?.status === "RESERVED"
              ? "Kaydınız alındı, ödemeniz onaylandığında yayına katılabilirsiniz."
              : "Bu yayın yalnızca atölyeye kayıtlı katılımcılara açık.",
            code: "ENROLLMENT_REQUIRED",
            workshop: w,
          },
          { status: 403 }
        )
      }
    }
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
