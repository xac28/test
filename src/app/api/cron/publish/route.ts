import { NextResponse } from "next/server"
import { cronGuard } from "@/lib/cron"
import { runScheduledPublish } from "@/lib/automation"

// POST /api/cron/publish — run every 5 minutes: publishes the articles, podcast episodes and products whose scheduled time has come
export async function POST(req: Request) {
  const denied = cronGuard(req)
  if (denied) return denied
  try {
    return NextResponse.json({ success: true, ...(await runScheduledPublish()) })
  } catch (e) {
    console.error("[CRON_PUBLISH]", e)
    return NextResponse.json({ error: "Zamanlanmış yayın çalıştırılamadı" }, { status: 500 })
  }
}
