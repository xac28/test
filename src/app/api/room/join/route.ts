import { db } from "@/lib/db"
import { createLiveKitToken } from "@/lib/livekit"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"

// POST /api/room/join — Creates/joins a livekit room for a booking
export async function POST(req: Request) {
  try {
    const user = await resolveUser(req)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { bookingId } = await req.json()
    if (!bookingId) {
      return NextResponse.json({ error: "bookingId is required" }, { status: 400 })
    }

    // Get booking and verify user is participant
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        teacher: { include: { user: true } },
        student: true,
      },
    })

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    // Only the student or the teacher of this booking can join
    const isStudent = booking.studentId === user.id
    const isTeacher = booking.teacher.userId === user.id

    if (!isStudent && !isTeacher) {
      return NextResponse.json({ error: "Not authorized for this booking" }, { status: 403 })
    }

    if (booking.status !== "CONFIRMED") {
      return NextResponse.json({ error: "Booking is not confirmed yet" }, { status: 400 })
    }

    let roomName = booking.dailyRoomName
    let roomUrl = booking.dailyRoomUrl
    const livekitUrl = process.env.LIVEKIT_URL || "ws://localhost:7880"

    // Create room if it doesn't exist yet
    if (!roomName || !roomUrl) {
      roomName = `room-${booking.id}`
      roomUrl = livekitUrl

      await db.booking.update({
        where: { id: booking.id },
        data: {
          dailyRoomName: roomName,
          dailyRoomUrl: roomUrl,
        },
      })
    }

    // Create a meeting token — teacher gets owner privileges
    const token = await createLiveKitToken(
      roomName,
      user.name || "Guest",
      isTeacher
    )

    return NextResponse.json({
      roomUrl: livekitUrl,
      roomName,
      token,
      role: isTeacher ? "teacher" : "student",
      booking: {
        id: booking.id,
        startTime: booking.startTime,
        endTime: booking.endTime,
        teacherName: booking.teacher.user.name,
        studentName: booking.student.name,
      },
    })
  } catch (error: any) {
    console.error("[ROOM_JOIN_ERROR]", error)
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 })
  }
}
