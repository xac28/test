import { db } from "@/lib/db"
import { createLiveKitToken } from "@/lib/livekit"
import { NextResponse } from "next/server"
import { termsGate } from "@/lib/terms"
import { resolveUser } from "@/lib/auth-utils"
import { createLiveKitRoom, endLiveRoom } from "@/lib/live-rooms"

async function teacherFor(user: { id: string; role: string }) {
  let teacher = await db.teacher.findUnique({ where: { userId: user.id } })
  if (!teacher && user.role === "ADMIN") {
    teacher = await db.teacher.create({
      data: { userId: user.id, bio: "Admin Test Profile", hourlyRate: 0, isTrialMode: false },
    })
  }
  return teacher
}

function hostToken(roomName: string, user: { id: string; name: string | null }) {
  return createLiveKitToken(roomName, user.name || "Teacher", true, {
    identity: user.id,
    metadata: JSON.stringify({ role: "host" }),
  })
}

// POST /api/room/instant — Teacher starts an instant live session
export async function POST(req: Request) {
  try {
    const user = await resolveUser(req)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const termsBlock = termsGate(user)
    if (termsBlock) return termsBlock

    if (user.role !== "TEACHER" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only teachers can start live sessions" }, { status: 403 })
    }

    const teacher = await teacherFor(user)
    if (!teacher) {
      return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 })
    }

    const body = await req.json().catch(() => ({}))

    // A workshop session: only the workshop's own teacher may broadcast it
    let workshop: { id: string; title: string } | null = null
    if (body.workshopId) {
      const w = await db.workshop.findUnique({ where: { id: String(body.workshopId) } })
      if (!w || w.teacherId !== teacher.id || w.status !== "PUBLISHED" || w.mode !== "LIVE") {
        return NextResponse.json({ error: "Bu atölyeyi yayınlayamazsınız." }, { status: 403 })
      }
      workshop = { id: w.id, title: w.title }
    }

    const title = String(body.title || "").trim().slice(0, 120) || workshop?.title || "Canlı Yoga Dersi"
    const roomName = `live-${teacher.id}-${Date.now()}`
    const livekitUrl = process.env.LIVEKIT_URL || "ws://localhost:7880"

    // Close any existing active rooms by this teacher (and disconnect their viewers)
    const previous = await db.liveRoom.findMany({ where: { teacherId: teacher.id, isActive: true }, select: { id: true } })
    for (const p of previous) await endLiveRoom(p.id).catch(() => {})

    const liveRoom = await db.liveRoom.create({
      data: { teacherId: teacher.id, roomName, title, isActive: true, workshopId: workshop?.id ?? null },
    })
    await createLiveKitRoom(roomName, title)

    return NextResponse.json({
      roomUrl: livekitUrl,
      roomName,
      token: await hostToken(roomName, user),
      liveRoomId: liveRoom.id,
      title,
      role: "teacher",
    })
  } catch (error: any) {
    console.error("[INSTANT_ROOM_ERROR]", error)
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 })
  }
}

// GET /api/room/instant — resume: fresh host token for the teacher's currently active room (if any)
export async function GET(req: Request) {
  try {
    const user = await resolveUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (user.role !== "TEACHER" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const teacher = await db.teacher.findUnique({ where: { userId: user.id } })
    if (!teacher) return NextResponse.json({ active: null })

    const room = await db.liveRoom.findFirst({ where: { teacherId: teacher.id, isActive: true }, orderBy: { createdAt: "desc" } })
    if (!room) return NextResponse.json({ active: null })

    return NextResponse.json({
      active: {
        roomUrl: process.env.LIVEKIT_URL || "ws://localhost:7880",
        roomName: room.roomName,
        liveRoomId: room.id,
        title: room.title,
        startedAt: room.createdAt,
        token: await hostToken(room.roomName, user),
        role: "teacher",
      },
    })
  } catch (error: any) {
    console.error("[INSTANT_ROOM_RESUME_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
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

    await endLiveRoom(liveRoomId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[END_ROOM_ERROR]", error)
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 })
  }
}
