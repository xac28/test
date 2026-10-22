import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { applyRateLimit } from "@/lib/api-protection"
import { enforceTeacherText, suspensionGate } from "@/lib/policy"

// POST /api/policy/check { text, surface? } — used by the live chat (messages travel peer-to-peer, so the browser asks first).
// A teacher's message that takes students off the platform is recorded as a violation and refused.
export async function POST(req: Request) {
  const blocked = applyRateLimit(req, { maxRequests: 60, windowMs: 60_000 })
  if (blocked) return blocked
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const text = typeof body.text === "string" ? body.text.slice(0, 600) : ""
  if (user.role === "TEACHER") {
    const susp = await suspensionGate(user.id)
    if (susp) return susp
  }
  const hit = await enforceTeacherText(user, [text], "LIVE_CHAT")
  if (hit) return NextResponse.json({ ok: false, error: hit.error, code: hit.code, policy: { strike: hit.policy.strike, action: hit.policy.action } }, { status: hit.status })
  return NextResponse.json({ ok: true })
}
