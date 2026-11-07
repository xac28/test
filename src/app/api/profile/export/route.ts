import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_AUTH } from "@/lib/rate-limit"
import { exportUserData } from "@/lib/account"
import { logEvent } from "@/lib/event-log"

export const dynamic = "force-dynamic"

// GET /api/profile/export → the signed-in person's data as a JSON download
export async function GET(req: Request) {
  const blocked = applyRateLimit(req, RATE_LIMIT_AUTH)
  if (blocked) return blocked
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const data = await exportUserData(user.id)
  await logEvent({ type: "SECURITY", message: "Kişisel veriler indirildi", userId: user.id })
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": 'attachment; filename="aya-verilerim.json"', "Cache-Control": "no-store" },
  })
}
