import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { termsGate } from "@/lib/terms"
import { pickRecordingMimeType, retentionExpiry, isExpired } from "@/lib/recordings"

export const dynamic = "force-dynamic"

// POST /api/recordings — the TEACHER starts recording a lesson (booking or instant live room)
export async function POST(req: Request) {
  try {
    const user = await resolveUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const termsBlock = termsGate(user)
    if (termsBlock) return termsBlock

    const body = await req.json().catch(() => ({}))
    const { bookingId, liveRoomId } = body as { bookingId?: string; liveRoomId?: string }
    if (!bookingId && !liveRoomId) {
      return NextResponse.json({ error: "bookingId veya liveRoomId gerekli" }, { status: 400 })
    }

    let roomName: string
    let studentUserId: string | null = null
    let teacherUserId: string

    if (bookingId) {
      const booking = await db.booking.findUnique({
        where: { id: bookingId },
        include: { teacher: true },
      })
      if (!booking) return NextResponse.json({ error: "Ders bulunamadı" }, { status: 404 })
      if (booking.teacher.userId !== user.id) {
        return NextResponse.json({ error: "Yalnızca dersin öğretmeni kayıt başlatabilir" }, { status: 403 })
      }
      if (booking.status !== "CONFIRMED" && booking.status !== "COMPLETED") {
        return NextResponse.json({ error: "Ders onaylı değil" }, { status: 400 })
      }
      roomName = booking.dailyRoomName || `room-${booking.id}`
      studentUserId = booking.studentId
      teacherUserId = booking.teacher.userId
    } else {
      const liveRoom = await db.liveRoom.findUnique({
        where: { id: liveRoomId! },
        include: { teacher: true },
      })
      if (!liveRoom) return NextResponse.json({ error: "Canlı oda bulunamadı" }, { status: 404 })
      if (liveRoom.teacher.userId !== user.id) {
        return NextResponse.json({ error: "Yalnızca oda sahibi kayıt başlatabilir" }, { status: 403 })
      }
      roomName = liveRoom.roomName
      teacherUserId = liveRoom.teacher.userId
    }

    const now = new Date()
    const recording = await db.lessonRecording.create({
      data: {
        bookingId: bookingId || null,
        liveRoomId: bookingId ? null : liveRoomId || null,
        roomName,
        teacherUserId,
        studentUserId,
        mimeType: pickRecordingMimeType(body.mimeType),
        startedAt: now,
        expiresAt: retentionExpiry(now),
      },
    })

    return NextResponse.json({ id: recording.id, expiresAt: recording.expiresAt })
  } catch (error) {
    console.error("[RECORDING_START_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

// GET /api/recordings — recordings the signed-in user may download (as teacher or student)
export async function GET(req: Request) {
  try {
    const user = await resolveUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const rows = await db.lessonRecording.findMany({
      where: {
        status: "READY",
        deletedAt: null,
        OR: [{ teacherUserId: user.id }, { studentUserId: user.id }],
      },
      orderBy: { startedAt: "desc" },
      take: 100,
    })

    const now = new Date()
    const userIds = Array.from(
      new Set(rows.flatMap((r) => [r.teacherUserId, r.studentUserId]).filter(Boolean) as string[])
    )
    const people = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    })
    const nameOf = new Map(people.map((p) => [p.id, p.name]))

    return NextResponse.json({
      recordings: rows
        .filter((r) => !isExpired(r, now))
        .map((r) => ({
          id: r.id,
          roomName: r.roomName,
          bookingId: r.bookingId,
          startedAt: r.startedAt,
          expiresAt: r.expiresAt,
          durationSec: r.durationSec,
          sizeBytes: Number(r.sizeBytes),
          teacherName: nameOf.get(r.teacherUserId) ?? null,
          studentName: r.studentUserId ? nameOf.get(r.studentUserId) ?? null : null,
          downloadUrl: `/api/recordings/${r.id}/download`,
        })),
    })
  } catch (error) {
    console.error("[RECORDING_LIST_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
