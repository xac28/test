import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { currentRelease, streamerEligibility } from "@/lib/streamer"

export const dynamic = "force-dynamic"

// GET /api/streamer/info → whether the signed-in person may use the desktop app, and the installer's details
export async function GET(req: Request) {
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const el = await streamerEligibility(user.id)
  if (!el.ok) return NextResponse.json({ error: el.message, code: el.reason }, { status: 403 })
  const r = await currentRelease()
  return NextResponse.json({ available: !!r, release: r ? { version: r.version, file: r.file, size: r.size, sha256: r.sha256, builtAt: r.builtAt } : null })
}
