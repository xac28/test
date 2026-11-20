import { NextResponse } from "next/server"
import { rateLimit } from "@/lib/rate-limit"
import { extractIp } from "@/lib/ban-engine"
import { unsubscribeByToken } from "@/lib/newsletter"

export const dynamic = "force-dynamic"

// POST /api/newsletter/unsubscribe { token } — the button on /bulten/ayril (a GET link would be "clicked" by mail scanners)
export async function POST(req: Request) {
  if (!rateLimit(`unsub:${extractIp(req)}`, { maxRequests: 10, windowMs: 60_000 }).allowed) return NextResponse.json({ error: "Çok fazla deneme." }, { status: 429 })
  const body = await req.json().catch(() => null)
  const ok = await unsubscribeByToken(typeof body?.token === "string" ? body.token : "")
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Bağlantı geçersiz veya süresi dolmuş." }, { status: 404 })
}
