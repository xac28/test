import { NextResponse } from "next/server"
import { cronGuard } from "@/lib/cron"
import { runAdminDigest, runWeeklyDigest, runWinback } from "@/lib/automation"

// POST /api/cron/digests — run once a day (morning): the admins' summary; on Mondays also the weekly newsletter digest.
// Also nudges students who have been away for a month (once per 60 days each). ?weekly=1 forces the newsletter digest on any day, ?weekly=0 skips it. The weekly digest never goes out twice in one week.
export async function POST(req: Request) {
  const denied = cronGuard(req)
  if (denied) return denied
  try {
    const url = new URL(req.url)
    const now = new Date()
    const monday = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Istanbul" })).getDay() === 1
    const weekly = url.searchParams.get("weekly")
    const admin = await runAdminDigest(now)
    const newsletter = weekly === "1" || (weekly !== "0" && monday) ? await runWeeklyDigest(now) : null
    // ?winback=0 skips the "we miss you" nudges
    const winback = url.searchParams.get("winback") === "0" ? null : await runWinback(now)
    return NextResponse.json({ success: true, admin, newsletter, winback })
  } catch (e) {
    console.error("[CRON_DIGESTS]", e)
    return NextResponse.json({ error: "Özetler çalıştırılamadı" }, { status: 500 })
  }
}
