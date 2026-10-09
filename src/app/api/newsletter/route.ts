import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { rateLimit } from "@/lib/rate-limit"
import { extractIp } from "@/lib/ban-engine"

export const dynamic = "force-dynamic"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// POST /api/newsletter { email } → subscribes the address (idempotent)
export async function POST(req: Request) {
  const limit = rateLimit(`newsletter:${extractIp(req)}`, { maxRequests: 6, windowMs: 60_000 })
  if (!limit.allowed) return NextResponse.json({ error: "Çok fazla deneme. Biraz sonra tekrar deneyin." }, { status: 429 })

  const body = await req.json().catch(() => null)
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  if (email.length > 190 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Geçerli bir e-posta adresi girin." }, { status: 400 })
  }
  try {
    await db.newsletterSubscriber.upsert({ where: { email }, create: { email }, update: {} })
  } catch (e) {
    console.error("[NEWSLETTER]", e)
    return NextResponse.json({ error: "Şu anda kaydedilemedi, lütfen tekrar deneyin." }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
