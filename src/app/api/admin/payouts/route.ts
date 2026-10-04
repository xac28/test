import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"

// GET /api/admin/payouts?status=PENDING — payout requests for the admin approval screen
export async function GET(req: Request) {
  try {
    const user = await resolveUser(req)
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const status = new URL(req.url).searchParams.get("status")
    const where = status && ["PENDING", "APPROVED", "REJECTED", "PAID"].includes(status) ? { status: status as any } : {}

    const requests = await db.payoutRequest.findMany({
      where,
      include: { teacher: { include: { user: { select: { name: true, email: true, image: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    })
    return NextResponse.json({ requests })
  } catch (error) {
    console.error("[ADMIN_PAYOUTS_GET_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
