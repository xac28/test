import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { rateLimit } from "@/lib/rate-limit"
import { extractIp } from "@/lib/ban-engine"

export const dynamic = "force-dynamic"

// GET /api/shop/orders/:code — what the customer may see: items, totals, status, tracking. Never the address or phone.
export async function GET(req: Request, { params }: { params: { code: string } }) {
  if (!rateLimit(`order-lookup:${extractIp(req)}`, { maxRequests: 20, windowMs: 60_000 }).allowed) return NextResponse.json({ error: "Çok fazla deneme." }, { status: 429 })
  const o = await db.order.findUnique({ where: { code: params.code.toUpperCase() }, include: { items: true } })
  if (!o) return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 })
  return NextResponse.json({
    code: o.code, status: o.status, payMethod: o.payMethod, createdAt: o.createdAt, city: o.city, trackingNo: o.trackingNo,
    subtotalKurus: o.subtotalKurus, shippingKurus: o.shippingKurus, totalKurus: o.totalKurus,
    items: o.items.map((i) => ({ name: i.name, unitKurus: i.unitKurus, quantity: i.quantity })),
  })
}
