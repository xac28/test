import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-api"
import { parseImages, validateProductInput } from "@/lib/shop"
import { notifyNewContent } from "@/lib/content-notify"
import { notifyRestock } from "@/lib/automation"

export const dynamic = "force-dynamic"

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const a = await requireAdmin(req)
  if ("response" in a) return a.response
  const product = await db.product.findUnique({ where: { id: params.id } })
  return product ? NextResponse.json({ product }) : NextResponse.json({ error: "Ürün bulunamadı" }, { status: 404 })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const a = await requireAdmin(req)
  if ("response" in a) return a.response
  const existing = await db.product.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: "Ürün bulunamadı" }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const v = validateProductInput({ priceTL: existing.priceKurus / 100, ...existing, images: parseImages(existing.images), ...body })
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  const product = await db.product.update({ where: { id: params.id }, data: v.data })
  let newsletter = null
  if (v.notify && product.status === "PUBLISHED") newsletter = await notifyNewContent("product", product.id, a.admin.id).catch((e) => (console.error("[PRODUCT_NOTIFY]", e), null))
  // sold out → back in stock: tell the visitors who asked to be told
  if (existing.stock <= 0 && product.stock > 0) await notifyRestock([product.id]).catch((e) => console.error("[RESTOCK]", e))
  return NextResponse.json({ success: true, product, newsletter })
}

// Orders keep their own copy of name and price, so deleting a product never breaks an old order.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const a = await requireAdmin(req)
  if ("response" in a) return a.response
  await db.product.deleteMany({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
