import { NextResponse } from "next/server"
import { subscriptionMaintenance } from "@/lib/subscription-server"

// POST /api/cron/subscriptions — hourly: re-syncs memberships near their renewal with iyzico (in case a notification was missed)
export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 })
  if (req.headers.get("authorization")?.replace("Bearer ", "") !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized — invalid cron secret" }, { status: 401 })
  }
  return NextResponse.json({ success: true, ...(await subscriptionMaintenance()) })
}
