import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-api"
import { computeBrandAvailableKurus, computeBrandClaimedKurus, computeBrandEarnedKurus, validateBrandInput } from "@/lib/brands"

export const dynamic = "force-dynamic"

async function balanceOf(brandId: string, commissionRate: number) {
  const [items, payouts] = await Promise.all([
    db.orderItem.findMany({ where: { brandId }, select: { unitKurus: true, quantity: true, brandCommissionRate: true, order: { select: { status: true } } } }),
    db.brandPayout.findMany({ where: { brandId }, orderBy: { paidAt: "desc" } }),
  ])
  const earnedKurus = computeBrandEarnedKurus(items)
  const claimedKurus = computeBrandClaimedKurus(payouts)
  return { earnedKurus, claimedKurus, availableKurus: computeBrandAvailableKurus(earnedKurus, claimedKurus), payouts, commissionRate }
}

// GET /api/admin/brands/:id — profile + balance + payout history + its products
export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const a = await requireAdmin(req)
  if ("response" in a) return a.response
  const brand = await db.brand.findUnique({ where: { id: params.id }, include: { products: { orderBy: { createdAt: "desc" }, select: { id: true, name: true, status: true, priceKurus: true, stock: true } } } })
  if (!brand) return NextResponse.json({ error: "Marka bulunamadı" }, { status: 404 })
  const balance = await balanceOf(brand.id, brand.commissionRate)
  return NextResponse.json({ brand, ...balance })
}

// PATCH /api/admin/brands/:id — edit the brand's profile
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const a = await requireAdmin(req)
  if ("response" in a) return a.response
  const existing = await db.brand.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: "Marka bulunamadı" }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const v = validateBrandInput({ ...existing, ...body })
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  const brand = await db.brand.update({ where: { id: params.id }, data: v.data })
  return NextResponse.json({ success: true, brand })
}

// DELETE /api/admin/brands/:id — deactivates (never a hard delete: past sales and payout history must stay attributable)
export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const a = await requireAdmin(req)
  if ("response" in a) return a.response
  const brand = await db.brand.update({ where: { id: params.id }, data: { active: false } }).catch(() => null)
  if (!brand) return NextResponse.json({ error: "Marka bulunamadı" }, { status: 404 })
  return NextResponse.json({ success: true })
}
