import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { termsGate } from "@/lib/terms"
import { createLiveKitToken } from "@/lib/livekit"
import { trialRoleFor, trialRoomName } from "@/lib/trial"

// POST /api/room/trial { teacherId? } — token for the private trial room.
// Candidate: a teacher still in trial mode (own room). Reviewer: any admin (needs teacherId).
export async function POST(req: Request) {
  try {
    const user = await resolveUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const termsBlock = termsGate(user)
    if (termsBlock) return termsBlock

    const body = await req.json().catch(() => ({}))
    const teacher = body.teacherId
      ? await db.teacher.findUnique({ where: { id: String(body.teacherId) }, include: { user: true } })
      : await db.teacher.findUnique({ where: { userId: user.id }, include: { user: true } })
    if (!teacher) return NextResponse.json({ error: "Öğretmen bulunamadı" }, { status: 404 })

    const role = trialRoleFor(user, teacher)
    if (!role) {
      const approved = teacher.userId === user.id && !teacher.isTrialMode
      return NextResponse.json(
        { error: approved ? "Eğitmenliğiniz zaten onaylı, deneme yayınına gerek yok." : "Bu odaya erişiminiz yok.", code: approved ? "ALREADY_APPROVED" : "FORBIDDEN" },
        { status: approved ? 400 : 403 }
      )
    }

    const roomName = trialRoomName(teacher.id)
    const token = await createLiveKitToken(roomName, user.name || (role === "reviewer" ? "Yetkili" : "Aday"), role === "reviewer", {
      identity: user.id,
      ttl: "2h",
      metadata: JSON.stringify({ role }),
    })

    return NextResponse.json({
      roomUrl: process.env.LIVEKIT_URL || "ws://localhost:7880",
      roomName,
      token,
      role,
      teacher: { id: teacher.id, name: teacher.user.name, trialNote: teacher.trialNote },
    })
  } catch (error) {
    console.error("[TRIAL_ROOM_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
