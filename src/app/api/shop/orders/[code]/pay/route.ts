import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { rateLimit } from "@/lib/rate-limit"
import { extractIp } from "@/lib/ban-engine"
import { resolveUser } from "@/lib/auth-utils"
import { SITE_URL } from "@/lib/site"
import { iyzicoMode, startShopCheckout } from "@/lib/iyzico"

export const dynamic = "force-dynamic"

// POST /api/shop/orders/:code/pay { email } — starts (or restarts) the card payment of an unpaid card order.
// The e-mail of the order is the proof that the person knows this order; the amount always comes from the order, never from the browser.
export async function POST(req: Request, { params }: { params: { code: string } }) {
  const ip = extractIp(req)
  if (!rateLimit(`order-pay:${ip}`, { maxRequests: 20, windowMs: 60_000 }).allowed) return NextResponse.json({ error: "Çok fazla deneme. Biraz sonra tekrar deneyin." }, { status: 429 })
  if (iyzicoMode() === "off") return NextResponse.json({ error: "Kartla ödeme şu an kullanılamıyor." }, { status: 503 })
  const body = await req.json().catch(() => ({}))
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  const o = await db.order.findUnique({ where: { code: params.code.toUpperCase() }, include: { items: true } })
  if (!o || !email || o.email.toLowerCase() !== email) return NextResponse.json({ error: "Sipariş bulunamadı. Kodu ve e-postayı kontrol edin." }, { status: 404 })
  if (o.payMethod !== "kart") return NextResponse.json({ error: "Bu sipariş kartla ödenmeyecek." }, { status: 400 })
  if (o.status !== "PENDING_PAYMENT") return NextResponse.json({ error: o.status === "CANCELLED" ? "Bu sipariş iptal edildi; yeni bir sipariş verin." : "Bu siparişin ödemesi zaten alındı." }, { status: 409 })
  try {
    const user = await resolveUser(req).catch(() => null)
    const started = await startShopCheckout(
      { code: o.code, totalKurus: o.totalKurus, shippingKurus: o.shippingKurus, email: o.email, name: o.name, phone: o.phone, address: o.address, city: o.city, items: o.items.map((i) => ({ id: i.productId ?? i.id, name: i.name, unitKurus: i.unitKurus, quantity: i.quantity })) },
      { callbackUrl: `${SITE_URL}/api/iyzico/shop-callback`, ip, userId: user?.id },
    )
    return NextResponse.json({ success: true, htmlContent: started.html })
  } catch (e) {
    console.error("[SHOP_PAY]", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Ödeme başlatılamadı." }, { status: 502 })
  }
}
