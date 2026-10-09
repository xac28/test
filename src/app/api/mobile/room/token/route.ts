import { db } from "@/lib/db"
import { createLiveKitToken } from "@/lib/livekit"
import { NextResponse } from "next/server"
import { termsGate } from "@/lib/terms"
import { resolveUser } from "@/lib/auth-utils"

// POST /api/mobile/room/token — Get LiveKit token for a booking
export async function POST(req: Request) {
  try {
    const user = await resolveUser(req)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const termsBlock = termsGate(user)
    if (termsBlock) return termsBlock

    const { bookingId } = await req.json()
    if (!bookingId) {
      return NextResponse.json({ error: "bookingId is required" }, { status: 400 })
    }

    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        teacher: { include: { user: true } },
      },
    })

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    const isStudent = booking.studentId === user.id
    const isTeacher = booking.teacher.userId === user.id

    if (!isStudent && !isTeacher) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }

    if (booking.status !== "CONFIRMED") {
      return NextResponse.json({ error: "Booking not confirmed" }, { status: 400 })
    }

    const roomName = booking.dailyRoomName || `room-${booking.id}`
    const livekitUrl = process.env.LIVEKIT_URL || "ws://localhost:7880"

    const token = await createLiveKitToken(
      roomName,
      user.name || "MobileUser",
      isTeacher,
      { identity: user.id }
    )

    return NextResponse.json({
      token,
      roomName,
      roomUrl: livekitUrl,
      role: isTeacher ? "teacher" : "student"
    })
  } catch (error: any) {
    console.error("[MOBILE_ROOM_TOKEN_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
