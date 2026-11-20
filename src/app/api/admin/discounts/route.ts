import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-api"
import { validatePersonalDiscountInput } from "@/lib/discounts"

export const dynamic = "force-dynamic"

// GET /api/admin/discounts?q=&role=STUDENT|TEACHER — students/teachers to grant or review a personal discount for
export async function GET(req: Request) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const url = new URL(req.url)
  const q = (url.searchParams.get("q") || "").trim().slice(0, 100)
  const role = url.searchParams.get("role")
  const where: any = { role: { in: ["STUDENT", "TEACHER"] } }
  if (role === "STUDENT" || role === "TEACHER") where.role = role
  if (q) where.OR = [{ name: { contains: q } }, { email: { contains: q } }]

  const rows = await db.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, name: true, email: true, role: true, banned: true, personalDiscount: true },
  })
  return NextResponse.json({
    users: rows.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, banned: u.banned, discount: u.personalDiscount })),
  })
}

// POST /api/admin/discounts { userId, discountPct, reason?, endsAt? } — grant or replace a personal discount
export async function POST(req: Request) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const body = await req.json().catch(() => ({}))
  const userId = typeof body.userId === "string" ? body.userId : ""
  if (!userId) return NextResponse.json({ error: "Kullanıcı seçin." }, { status: 400 })
  const v = validatePersonalDiscountInput(body)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  const target = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, name: true } })
  if (!target) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 })
  if (target.role !== "STUDENT" && target.role !== "TEACHER") {
    return NextResponse.json({ error: "Kişisel indirim yalnızca öğrenci veya öğretmen hesaplarına verilebilir." }, { status: 400 })
  }

  const discount = await db.personalDiscount.upsert({
    where: { userId },
    create: { userId, discountPct: v.discountPct, reason: v.reason, endsAt: v.endsAt, createdById: g.admin.id },
    update: { discountPct: v.discountPct, reason: v.reason, endsAt: v.endsAt, createdById: g.admin.id },
  })
  await db.auditLog.create({
    data: {
      actorId: g.admin.id, action: "PERSONAL_DISCOUNT_GRANT", targetId: userId,
      reason: `${target.name ?? target.id}: %${v.discountPct} indirim${v.discountPct >= 100 ? " (ücretsiz hesap)" : ""}${v.reason ? ` — ${v.reason}` : ""}`,
    },
  })
  return NextResponse.json({ success: true, discount })
}
