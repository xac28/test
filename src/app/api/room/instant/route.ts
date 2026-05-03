import { db } from "@/lib/db"
import { createLiveKitToken } from "@/lib/livekit"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"

// POST /api/room/instant — Teacher starts an instant live session
export async function POST(req: Request) {
  try {
    const user = await resolveUser(req)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "TEACHER" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only teachers can start live sessions" }, { status: 403 })
    }

    let teacher = await db.teacher.findUnique({
      where: { userId: user.id },
    })

    if (!teacher) {
      if (user.role === "ADMIN") {
        teacher = await db.teacher.create({
          data: {
            userId: user.id,
            bio: "Admin Test Profile",
            hourlyRate: 0,
            isTrialMode: false,
          }
        })
      } else {
        return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 })
      }
    }

    const { title } = await req.json()
    const roomName = `live-${teacher.id}-${Date.now()}`
    const livekitUrl = process.env.LIVEKIT_URL || "ws://localhost:7880"

    // Close any existing active rooms by this teacher
    await db.liveRoom.updateMany({
      where: { teacherId: teacher.id, isActive: true },
      data: { isActive: false, endedAt: new Date() }
    })

    // Create new live room record
    const liveRoom = await db.liveRoom.create({
      data: {
        teacherId: teacher.id,
        roomName,
        title: title || "Live Yoga Session",
        isActive: true,
      }
    })

    // Generate teacher token with admin privileges
    const token = await createLiveKitToken(
      roomName,
      user.name || "Teacher",
      true // isTeacher = admin privileges
    )

    return NextResponse.json({
      roomUrl: livekitUrl,
      roomName,
      token,
      liveRoomId: liveRoom.id,
      role: "teacher",
    })
  } catch (error: any) {
    console.error("[INSTANT_ROOM_ERROR]", error)
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 })
  }
}

// ── FIX #6: DELETE /api/room/instant — Sahiplik kontrolü eklendi ──
export async function DELETE(req: Request) {
  try {
    const user = await resolveUser(req)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { liveRoomId } = await req.json()

    if (!liveRoomId) {
      return NextResponse.json({ error: "liveRoomId is required" }, { status: 400 })
    }

    // LiveRoom'u bul
    const liveRoom = await db.liveRoom.findUnique({
      where: { id: liveRoomId },
      include: { teacher: true }
    })

    if (!liveRoom) {
      return NextResponse.json({ error: "Live room not found" }, { status: 404 })
    }

    // Sahiplik kontrolü: Sadece oda sahibi veya admin kapatabilir
    if (liveRoom.teacher.userId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden — you can only close your own rooms" }, { status: 403 })
    }

    await db.liveRoom.update({
      where: { id: liveRoomId },
      data: { isActive: false, endedAt: new Date() }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[END_ROOM_ERROR]", error)
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 })
  }
}
