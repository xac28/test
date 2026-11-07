import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { CSV_LIMIT, pageOf, requireAdmin, wantsCsv } from "@/lib/admin-api"
import { ORDER_STATUS_LABEL, OrderStatusId, PAY_METHOD_LABEL } from "@/lib/shop"
import { toCsv } from "@/lib/csv"

export const dynamic = "force-dynamic"

const STATUSES = Object.keys(ORDER_STATUS_LABEL)

export async function GET(req: Request) {
  const a = await requireAdmin(req)
  if ("response" in a) return a.response
  const url = new URL(req.url)
  const status = url.searchParams.get("status") || "all"
  const q = (url.searchParams.get("q") || "").trim()
  const where = {
    ...(STATUSES.includes(status) ? { status: status as OrderStatusId } : {}),
    ...(q ? { OR: [{ code: { contains: q } }, { email: { contains: q } }, { name: { contains: q } }, { phone: { contains: q } }] } : {}),
  }
  const { page, size, skip } = pageOf(url, 20)

  if (wantsCsv(url)) {
    const rows = await db.order.findMany({ where, orderBy: { createdAt: "desc" }, take: CSV_LIMIT, include: { items: true } })
    const csv = toCsv(
      ["Sipariş", "Tarih", "Durum", "Ad soyad", "E-posta", "Telefon", "Şehir", "Adres", "Ödeme", "Ürünler", "Toplam (TL)", "Takip no"],
      rows.map((o) => [o.code, o.createdAt.toISOString(), ORDER_STATUS_LABEL[o.status as OrderStatusId], o.name, o.email, o.phone, o.city, o.address, PAY_METHOD_LABEL[o.payMethod] ?? o.payMethod, o.items.map((i) => `${i.name} x${i.quantity}`).join("; "), (o.totalKurus / 100).toFixed(2), o.trackingNo ?? ""]),
    )
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="siparisler.csv"' } })
  }

  const [orders, total, grouped, revenue] = await Promise.all([
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: size, include: { items: true } }),
    db.order.count({ where }),
    db.order.groupBy({ by: ["status"], _count: true }),
    db.order.aggregate({ where: { status: { in: ["PAID", "SHIPPED", "DELIVERED"] } }, _sum: { totalKurus: true } }),
  ])
  const statusCounts = Object.fromEntries(grouped.map((g) => [g.status, g._count]))
  return NextResponse.json({ orders, total, page, pageSize: size, statusCounts, revenueKurus: revenue._sum.totalKurus ?? 0 })
}
