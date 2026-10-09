import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { CURRENT_TERMS_VERSION, termsAcceptanceData } from "@/lib/terms"

// POST /api/terms/accept — the signed-in user (web cookie or mobile Bearer) accepts the current terms
export async function POST(req: Request) {
  try {
    const user = await resolveUser(req)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    if (body.acceptTerms !== true) {
      return NextResponse.json(
        { error: "Sözleşmeyi kabul etmeniz gerekmektedir.", code: "TERMS_REQUIRED" },
        { status: 400 }
      )
    }

    await db.user.update({ where: { id: user.id }, data: termsAcceptanceData() })

    return NextResponse.json({ success: true, termsVersion: CURRENT_TERMS_VERSION })
  } catch (error) {
    console.error("[TERMS_ACCEPT_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
