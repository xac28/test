import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { livekitRoomService } from "@/lib/livekit"
import { trialRoomName } from "@/lib/trial"

export const dynamic = "force-dynamic"

// GET /api/admin/trials — teachers awaiting a decision, and whether they are in their trial room right now
export async function GET(req: Request) {
  try {
    const admin = await resolveUser(req)
    if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const rows = await db.teacher.findMany({
      where: { isTrialMode: true },
      include: { user: { select: { name: true, email: true, image: true, createdAt: true } } },
      orderBy: { id: "desc" },
      take: 100,
    })

    const waiting = new Map<string, number>()
    if (rows.length) {
      try {
        const rooms = await livekitRoomService().listRooms(rows.map((t) => trialRoomName(t.id)))
        for (const r of rooms) waiting.set(r.name, r.numParticipants)
      } catch {
        /* LiveKit unreachable: show everyone as offline */
      }
    }

    return NextResponse.json({
      trials: rows.map((t) => ({
        id: t.id,
        name: t.user.name,
        email: t.user.email,
        image: t.user.image,
        specialties: t.specialties,
        trialNote: t.trialNote,
        createdAt: t.user.createdAt,
        inRoom: (waiting.get(trialRoomName(t.id)) ?? 0) > 0,
      })),
    })
  } catch (error) {
    console.error("[ADMIN_TRIALS_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
