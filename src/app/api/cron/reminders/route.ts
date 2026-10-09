import { NextResponse } from "next/server"
import { cronGuard } from "@/lib/cron"
import { runReminders } from "@/lib/automation"

// POST /api/cron/reminders — run every 15 minutes: 24 h / 1 h reminders for lessons and live workshops, review requests after lessons
export async function POST(req: Request) {
  const denied = cronGuard(req)
  if (denied) return denied
  try {
    return NextResponse.json({ success: true, ...(await runReminders()) })
  } catch (e) {
    console.error("[CRON_REMINDERS]", e)
    return NextResponse.json({ error: "Hatırlatmalar çalıştırılamadı" }, { status: 500 })
  }
}
