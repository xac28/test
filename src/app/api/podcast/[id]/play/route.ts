import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { rateLimit } from "@/lib/rate-limit"
import { extractIp } from "@/lib/ban-engine"

export const dynamic = "force-dynamic"

// POST /api/podcast/:id/play — counts one listen (the same visitor counts once per episode per hour)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const l = rateLimit(`play:${extractIp(req)}:${params.id}`, { maxRequests: 1, windowMs: 3_600_000 })
  if (!l.allowed) return NextResponse.json({ counted: false })
  const res = await db.podcastEpisode.updateMany({ where: { id: params.id, status: "PUBLISHED" }, data: { plays: { increment: 1 } } })
  return NextResponse.json({ counted: res.count > 0 })
}
