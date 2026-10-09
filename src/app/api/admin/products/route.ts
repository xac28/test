import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-api"
import { LOW_STOCK, validateProductInput } from "@/lib/shop"
import { uniqueSlug } from "@/lib/slug"
import { notifyNewContent } from "@/lib/content-notify"
import { scheduleData } from "@/lib/schedule"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const a = await requireAdmin(req)
  if ("response" in a) return a.response
  const url = new URL(req.url)
  const category = url.searchParams.get("category")
  const q = (url.searchParams.get("q") || "").trim()
  const products = await db.product.findMany({
    where: { ...(category ? { category } : {}), ...(q ? { name: { contains: q } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 300,
  })
  const low = await db.product.count({ where: { status: "PUBLISHED", stock: { lte: LOW_STOCK } } })
  return NextResponse.json({ products, lowStock: low })
}

export async function POST(req: Request) {
  const a = await requireAdmin(req)
  if ("response" in a) return a.response
  const input = await req.json().catch(() => ({}))
  const v = validateProductInput(input)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  const sch = scheduleData(input, v.data.status)
  if (!sch.ok) return NextResponse.json({ error: sch.error }, { status: 400 })
  const product = await db.product.create({ data: { ...v.data, ...sch.data, slug: uniqueSlug(v.data.name) } })
  let newsletter = null
  if (v.notify && product.status === "PUBLISHED") newsletter = await notifyNewContent("product", product.id, a.admin.id).catch((e) => (console.error("[PRODUCT_NOTIFY]", e), null))
  return NextResponse.json({ success: true, product, newsletter })
}
