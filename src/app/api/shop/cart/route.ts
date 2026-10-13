import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { parseImages } from "@/lib/shop"

export const dynamic = "force-dynamic"

// GET /api/shop/cart?ids=a,b — fresh price and stock of the products in a visitor's cart (published ones only)
export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("ids") || "").split(",").map((s) => s.trim()).filter((s) => /^[a-z0-9]{10,40}$/i.test(s)).slice(0, 30)
  if (ids.length === 0) return NextResponse.json({ products: [] })
  const rows = await db.product.findMany({ where: { id: { in: ids }, status: "PUBLISHED" } })
  return NextResponse.json({
    products: rows.map((p) => ({ id: p.id, slug: p.slug, name: p.name, priceKurus: p.priceKurus, stock: p.stock, image: parseImages(p.images)[0] ?? null })),
  })
}
