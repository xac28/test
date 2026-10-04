import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin, cleanReason } from "@/lib/admin-api"
import { keysFromInput, safeHref } from "@/lib/ai-learning"

// PATCH /api/admin/ai/taught/:id { question?, answer?, keywords?, linkLabel?, linkHref?, active? }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const row = await db.aiTaughtAnswer.findUnique({ where: { id: params.id } })
  if (!row) return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 })
  const b = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if (b.question !== undefined) {
    const v = cleanReason(b.question, 300)
    if (v.length < 3) return NextResponse.json({ error: "Soru en az 3 karakter olmalı." }, { status: 400 })
    data.question = v
  }
  if (b.answer !== undefined) {
    const v = typeof b.answer === "string" ? b.answer.trim().slice(0, 2000) : ""
    if (v.length < 5) return NextResponse.json({ error: "Cevap en az 5 karakter olmalı." }, { status: 400 })
    data.answer = v
  }
  if (b.keywords !== undefined) {
    const keys = keysFromInput(b.keywords)
    if (!keys.length) return NextResponse.json({ error: "En az bir anahtar kelime girin." }, { status: 400 })
    data.keys = JSON.stringify(keys)
  }
  if (b.linkHref !== undefined) {
    const href = b.linkHref ? safeHref(b.linkHref) : null
    if (b.linkHref && !href) return NextResponse.json({ error: "Geçersiz bağlantı." }, { status: 400 })
    data.linkHref = href
    data.linkLabel = href ? cleanReason(b.linkLabel, 60) || "Devamı" : null
  }
  if (typeof b.active === "boolean") data.active = b.active
  await db.aiTaughtAnswer.update({ where: { id: row.id }, data })
  await db.auditLog.create({ data: { actorId: g.admin.id, action: "AI_TAUGHT_EDIT", targetId: row.id, reason: Object.keys(data).join(", ") } })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const row = await db.aiTaughtAnswer.findUnique({ where: { id: params.id } })
  if (!row) return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 })
  await db.aiTaughtAnswer.delete({ where: { id: row.id } })
  await db.auditLog.create({ data: { actorId: g.admin.id, action: "AI_TAUGHT_DELETE", targetId: row.id, reason: row.question.slice(0, 200) } })
  return NextResponse.json({ success: true })
}
