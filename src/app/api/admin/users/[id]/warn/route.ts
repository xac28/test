import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin, cleanReason } from "@/lib/admin-api"
import { issueWarning } from "@/lib/report-server"

// POST /api/admin/users/:id/warn { message } — official warning (banner + e-mail)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const body = await req.json().catch(() => ({}))
  const message = cleanReason(body.message, 800)
  if (message.length < 10) return NextResponse.json({ error: "Uyarı metni en az 10 karakter olmalı." }, { status: 400 })
  const target = await db.user.findUnique({ where: { id: params.id }, select: { id: true, role: true } })
  if (!target) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 })
  if (target.role === "ADMIN") return NextResponse.json({ error: "Yönetici hesapları uyarılamaz." }, { status: 403 })
  const w = await issueWarning(g.admin.id, target.id, message)
  return NextResponse.json({ success: true, id: w.id })
}
