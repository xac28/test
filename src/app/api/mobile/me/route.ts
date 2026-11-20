import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"

export const dynamic = "force-dynamic"

// GET /api/mobile/me
export async function GET(req: Request) {
  try {
    const user = await resolveUser(req)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        termsAccepted: user.termsAccepted,
      },
    })
  } catch (error: any) {
    console.error("[MOBILE_ME_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
