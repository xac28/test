import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { decideTrial } from "@/lib/trial-server"

// POST /api/admin/teachers/:id/trial  { action: "approve" | "reject" | "revoke", note? }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await resolveUser(req)
    if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const { action, note } = await req.json().catch(() => ({}))
    const result = await decideTrial(admin.id, params.id, action, note)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ success: true, isTrialMode: result.isTrialMode })
  } catch (error) {
    console.error("[TRIAL_DECISION_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
