import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { termsGate } from "@/lib/terms"
import { emailGate } from "@/lib/email-verification"
import { applyRateLimit } from "@/lib/api-protection"
import { SITE_URL } from "@/lib/site"
import { db } from "@/lib/db"
import { isInterval, isPaidPlan, normalizeTrGsm } from "@/lib/subscriptions"
import { SubscriptionError, startSubscriptionCheckout } from "@/lib/subscription-server"

export const dynamic = "force-dynamic"

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "")

// POST /api/subscriptions/checkout — { plan, interval, phone, city, address } → iyzico's subscription payment form
export async function POST(req: Request) {
  const blocked = applyRateLimit(req, { maxRequests: 6, windowMs: 60_000 })
  if (blocked) return blocked
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: "Abone olmak için giriş yapın.", code: "LOGIN" }, { status: 401 })
  const termsBlock = termsGate(user)
  if (termsBlock) return termsBlock
  const verifyBlock = await emailGate(user.id)
  if (verifyBlock) return verifyBlock

  const body = await req.json().catch(() => ({}))
  if (!isPaidPlan(body.plan)) return NextResponse.json({ error: "Geçersiz plan." }, { status: 400 })
  if (!isInterval(body.interval)) return NextResponse.json({ error: "Geçersiz ödeme dönemi." }, { status: 400 })
  const gsm = normalizeTrGsm(body.phone)
  if (!gsm) return NextResponse.json({ error: "Geçerli bir cep telefonu numarası yazın (05xx xxx xx xx).", field: "phone" }, { status: 400 })
  const city = clean(body.city, 80)
  const address = clean(body.address, 300)
  if (city.length < 2) return NextResponse.json({ error: "Şehir gerekli.", field: "city" }, { status: 400 })
  if (address.length < 10) return NextResponse.json({ error: "Fatura adresini açık yazın.", field: "address" }, { status: 400 })

  const me = await db.user.findUnique({ where: { id: user.id }, select: { name: true, email: true, firstName: true, lastName: true } })
  const name = clean([me?.firstName, me?.lastName].filter(Boolean).join(" ") || me?.name || "", 120)
  if (!me?.email || name.length < 2) return NextResponse.json({ error: "Profilinde adın ve e-postan olmalı." }, { status: 400 })

  try {
    const r = await startSubscriptionCheckout(user.id, { plan: body.plan, interval: body.interval, name, email: me.email, gsm, city, address }, { callbackUrl: `${SITE_URL}/api/subscriptions/callback` })
    // remember the billing details for next time (the same fields the shop asks for)
    await db.user.update({ where: { id: user.id }, data: { phone: gsm, address: `${address}, ${city}`.slice(0, 400) } }).catch(() => {})
    return NextResponse.json({ success: true, html: r.html })
  } catch (e) {
    if (e instanceof SubscriptionError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status })
    console.error("[SUB_CHECKOUT]", e)
    return NextResponse.json({ error: "Abonelik başlatılamadı, lütfen tekrar deneyin." }, { status: 500 })
  }
}
