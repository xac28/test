import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"

export const dynamic = "force-dynamic"

// GET /api/streamer/devices → the signed-in teacher's paired apps (never the tokens)
export async function GET(req: Request) {
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const rows = await db.streamerDevice.findMany({ where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, appVersion: true, createdAt: true, lastUsedAt: true, expiresAt: true } })
  return NextResponse.json({ devices: rows })
}
