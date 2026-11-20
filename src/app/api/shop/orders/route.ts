import { NextResponse } from "next/server"
import { rateLimit } from "@/lib/rate-limit"
import { extractIp } from "@/lib/ban-engine"
import { resolveUser } from "@/lib/auth-utils"
import { validateOrderInput } from "@/lib/shop"
import { ShopError, createOrder } from "@/lib/shop-server"
import { subscribe } from "@/lib/newsletter"
import { iyzicoMode } from "@/lib/iyzico"

export const dynamic = "force-dynamic"

// POST /api/shop/orders — places an order (guests allowed); stock is reserved right away
export async function POST(req: Request) {
  if (!rateLimit(`order:${extractIp(req)}`, { maxRequests: 5, windowMs: 60_000 }).allowed) {
    return NextResponse.json({ error: "Çok fazla deneme. Biraz sonra tekrar deneyin." }, { status: 429 })
  }
  const body = await req.json().catch(() => ({}))
  const v = validateOrderInput(body)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  if (v.data.payMethod === "kart" && iyzicoMode() === "off") return NextResponse.json({ error: "Kartla ödeme şu an kullanılamıyor; havale ya da kapıda ödemeyi seçin." }, { status: 400 })
  try {
    const user = await resolveUser(req).catch(() => null)
    const order = await createOrder(v.data, user?.id ?? null)
    if (body.newsletter === true) await subscribe(v.data.email, "shop-order").catch(() => {})
    return NextResponse.json({ success: true, code: order.code })
  } catch (e) {
    if (e instanceof ShopError) return NextResponse.json({ error: e.message }, { status: 409 })
    console.error("[SHOP_ORDER]", e)
    return NextResponse.json({ error: "Sipariş oluşturulamadı, lütfen tekrar deneyin." }, { status: 500 })
  }
}
