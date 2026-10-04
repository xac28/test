import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"

export const dynamic = "force-dynamic"

// GET /api/warnings — official warnings from the admins that the user has not acknowledged yet
export async function GET(req: Request) {
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const all = new URL(req.url).searchParams.get("all") === "1"
  const warnings = await db.userWarning.findMany({
    where: { userId: user.id, ...(all ? {} : { acknowledgedAt: null }) },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, message: true, createdAt: true, acknowledgedAt: true },
  })
  const u = await db.user.findUnique({ where: { id: user.id }, select: { suspendedUntil: true, suspensionReason: true } })
  const suspension = u?.suspendedUntil && u.suspendedUntil.getTime() > Date.now() ? { until: u.suspendedUntil, reason: u.suspensionReason } : null
  return NextResponse.json({ warnings, suspension })
}
