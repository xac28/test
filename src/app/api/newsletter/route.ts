import { NextResponse } from "next/server"
import { rateLimit } from "@/lib/rate-limit"
import { extractIp } from "@/lib/ban-engine"
import { EMAIL_RE, normalizeEmail, subscribe } from "@/lib/newsletter"

export const dynamic = "force-dynamic"

// POST /api/newsletter { email, source? } → subscribes the address (idempotent, re-activates an unsubscribed one)
export async function POST(req: Request) {
  const limit = rateLimit(`newsletter:${extractIp(req)}`, { maxRequests: 6, windowMs: 60_000 })
  if (!limit.allowed) return NextResponse.json({ error: "Çok fazla deneme. Biraz sonra tekrar deneyin." }, { status: 429 })

  const body = await req.json().catch(() => null)
  const email = normalizeEmail(body?.email)
  if (email.length > 190 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Geçerli bir e-posta adresi girin." }, { status: 400 })
  }
  const source = typeof body?.source === "string" && /^[a-z0-9:_-]{1,60}$/i.test(body.source) ? body.source : "site"
  try {
    await subscribe(email, source)
  } catch (e) {
    console.error("[NEWSLETTER]", e)
    return NextResponse.json({ error: "Şu anda kaydedilemedi, lütfen tekrar deneyin." }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
