import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-api"
import { validateBrandInput } from "@/lib/brands"
import { uniqueSlug } from "@/lib/slug"

export const dynamic = "force-dynamic"

// GET /api/admin/brands — every brand (active and not), with its product count
export async function GET(req: Request) {
  const a = await requireAdmin(req)
  if ("response" in a) return a.response
  const url = new URL(req.url)
  const q = (url.searchParams.get("q") || "").trim()
  const brands = await db.brand.findMany({
    where: q ? { name: { contains: q } } : {},
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { products: true } } },
  })
  return NextResponse.json({ brands })
}

// POST /api/admin/brands — onboard a new brand partner
export async function POST(req: Request) {
  const a = await requireAdmin(req)
  if ("response" in a) return a.response
  const input = await req.json().catch(() => ({}))
  const v = validateBrandInput(input)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  const brand = await db.brand.create({ data: { ...v.data, slug: uniqueSlug(v.data.name) } })
  return NextResponse.json({ success: true, brand })
}
