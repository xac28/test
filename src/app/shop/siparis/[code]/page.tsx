import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { OrderStatusView } from "@/components/shop-pages"
import type { OrderStatusId } from "@/lib/shop"
import { iyzicoMode } from "@/lib/iyzico"

export const dynamic = "force-dynamic"
export const metadata = { title: "Sipariş durumu", robots: { index: false } }

export default async function OrderPage({ params }: { params: { code: string } }) {
  const o = await db.order.findUnique({ where: { code: params.code.toUpperCase() }, include: { items: true } }).catch(() => null)
  if (!o) notFound()
  return (
    <OrderStatusView
      o={{
        code: o.code, status: o.status as OrderStatusId, payMethod: o.payMethod, createdAt: o.createdAt.toISOString(), city: o.city, trackingNo: o.trackingNo,
        subtotalKurus: o.subtotalKurus, shippingKurus: o.shippingKurus, totalKurus: o.totalKurus,
        items: o.items.map((i) => ({ name: i.name, unitKurus: i.unitKurus, quantity: i.quantity })),
        bank: { name: process.env.SHOP_ACCOUNT_NAME ?? null, iban: process.env.SHOP_IBAN ?? null },
        cardEnabled: iyzicoMode() !== "off",
      }}
    />
  )
}
