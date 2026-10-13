import { db } from "@/lib/db"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// GET /api/health → 200 when the app and its database answer, 503 otherwise (for load balancers and uptime monitors)
export async function GET() {
  const started = Date.now()
  try {
    await db.$queryRaw`SELECT 1`
    return NextResponse.json({ status: "ok", db: "up", ms: Date.now() - started, time: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ status: "degraded", db: "down", time: new Date().toISOString() }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
}
