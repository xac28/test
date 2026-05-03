import { auth } from "@/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

// ── FIX #4: Audit log oluşturma sadece ADMIN role'üne açık ──
export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Role check — sadece admin audit log oluşturabilir
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 })
    }

    const { action, reason, roomName } = await req.json()

    // Input validasyonu
    if (!action || typeof action !== "string") {
      return NextResponse.json({ error: "Action is required" }, { status: 400 })
    }

    // Action whitelist — sadece bilinen action'lar kabul edilir
    const ALLOWED_ACTIONS = [
      "TIMEOUT", "BAN_USER", "UNBAN_USER", "CLOSE_ROOM", 
      "APPROVE_APPLICATION", "REJECT_APPLICATION", "WARN_USER",
      "DELETE_POST", "DELETE_COMMENT", "RESOLVE_REPORT"
    ]

    if (!ALLOWED_ACTIONS.includes(action)) {
      return NextResponse.json({ error: `Invalid action. Allowed: ${ALLOWED_ACTIONS.join(", ")}` }, { status: 400 })
    }

    await db.auditLog.create({
      data: {
        actorId: session.user.id,
        action,
        reason: reason || null,
        targetId: roomName || null
      }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[AUDIT_LOG_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}
