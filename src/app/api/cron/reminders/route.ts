import { NextResponse } from "next/server"
import { cronGuard } from "@/lib/cron"
import { runReminders, runSlaWatch, runUnpaidOrderReminders } from "@/lib/automation"

// POST /api/cron/reminders — run every 15 minutes: 24 h / 1 h reminders for lessons and live workshops, review requests after lessons,
// the one-time reminder for bank-transfer orders that are still unpaid after a day, and the waiting-too-long alerts for teacher applications
export async function POST(req: Request) {
  const denied = cronGuard(req)
  if (denied) return denied
  try {
    const now = new Date()
    return NextResponse.json({ success: true, ...(await runReminders(now)), unpaidOrders: await runUnpaidOrderReminders(now), sla: await runSlaWatch(now) })
  } catch (e) {
    console.error("[CRON_REMINDERS]", e)
    return NextResponse.json({ error: "Hatırlatmalar çalıştırılamadı" }, { status: 500 })
  }
}
