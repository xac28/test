import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { listActiveBroadcasts } from "@/lib/live-rooms"

export const dynamic = "force-dynamic"

// GET /api/live — who is live right now (with viewer counts)
export async function GET(req: Request) {
  try {
    const user = await resolveUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return NextResponse.json({ broadcasts: await listActiveBroadcasts() })
  } catch (error) {
    console.error("[LIVE_LIST_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
