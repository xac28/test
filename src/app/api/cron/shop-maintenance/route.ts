import { NextResponse } from "next/server"
import { cancelStaleOrders } from "@/lib/shop-server"

// POST /api/cron/shop-maintenance — run daily: cancels bank-transfer orders that stayed unpaid for 3 days (stock is released)
export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 })
  if (req.headers.get("authorization")?.replace("Bearer ", "") !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized — invalid cron secret" }, { status: 401 })
  }
  const result = await cancelStaleOrders()
  return NextResponse.json({ success: true, ...result })
}
