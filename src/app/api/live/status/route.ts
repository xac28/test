import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

// GET /api/live/status — public, tiny: is anybody live right now? (drives the dot in the navbar)
export async function GET() {
  try {
    const live = await db.liveRoom.count({
      where: { isActive: true, createdAt: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) } },
    })
    return NextResponse.json({ live }, { headers: { "Cache-Control": "public, max-age=15" } })
  } catch {
    return NextResponse.json({ live: 0 })
  }
}
