import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { decideTrial } from "@/lib/trial-server"

// Kept for older clients; same as POST /api/admin/teachers/:id/trial { action: "approve" }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await resolveUser(req)
    if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const result = await decideTrial(admin.id, params.id, "approve")
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[APPROVE_TRIAL_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}
