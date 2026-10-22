import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { termsGate } from "@/lib/terms"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_WRITE } from "@/lib/rate-limit"
import { moderateText } from "@/lib/moderation"
import { suspensionGate } from "@/lib/policy"

export const dynamic = "force-dynamic"

// GET /api/teacher/profile — the teacher's public text
export async function GET(req: Request) {
  const user = await resolveUser(req)
  if (!user || user.role !== "TEACHER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const t = await db.teacher.findUnique({ where: { userId: user.id }, select: { bio: true } })
  return NextResponse.json({ bio: t?.bio ?? "" })
}

// PATCH /api/teacher/profile { bio } — edit the public profile text; it goes through the same checks as every public text,
// plus the "taking students off the platform" ladder (warning → 10 days off → ban)
export async function PATCH(req: Request) {
  const blocked = applyRateLimit(req, RATE_LIMIT_WRITE)
  if (blocked) return blocked
  try {
    const user = await resolveUser(req)
    if (!user || user.role !== "TEACHER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const gate = termsGate(user)
    if (gate) return gate
    const susp = await suspensionGate(user.id)
    if (susp) return susp
    const body = await req.json().catch(() => ({}))
    const checked = await moderateText(user, body.bio, "PROFILE", { max: 1200, min: 20 })
    if (!checked.ok) return NextResponse.json({ error: checked.error, code: checked.code, policy: checked.policy ? { strike: checked.policy.strike, action: checked.policy.action } : undefined }, { status: checked.status })
    const t = await db.teacher.update({ where: { userId: user.id }, data: { bio: checked.text } })
    return NextResponse.json({ success: true, bio: t.bio })
  } catch (error) {
    console.error("[TEACHER_PROFILE_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}
