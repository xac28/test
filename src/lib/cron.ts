import { NextResponse } from "next/server"

/** Cron endpoints are protected by CRON_SECRET (Bearer token); returns the response to send when the caller is not allowed. */
export function cronGuard(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 })
  if (req.headers.get("authorization")?.replace("Bearer ", "") !== secret) return NextResponse.json({ error: "Unauthorized — invalid cron secret" }, { status: 401 })
  return null
}
