import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin, cleanReason } from "@/lib/admin-api"
import { isValidRecordingId, purgeRecordingFiles } from "@/lib/recordings"

// DELETE /api/admin/recordings/:id { reason } — removes the file for good (e.g. a recording that breaks the rules)
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const body = await req.json().catch(() => ({}))
  const reason = cleanReason(body.reason)
  if (reason.length < 3) return NextResponse.json({ error: "Silme nedeni gerekli." }, { status: 400 })
  if (!isValidRecordingId(params.id)) return NextResponse.json({ error: "Geçersiz kayıt" }, { status: 400 })
  const rec = await db.lessonRecording.findUnique({ where: { id: params.id } })
  if (!rec) return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 })
  await purgeRecordingFiles(rec.id).catch(() => {})
  await db.lessonRecording.update({ where: { id: rec.id }, data: { status: "EXPIRED", filePath: null, deletedAt: new Date() } })
  await db.auditLog.create({ data: { actorId: g.admin.id, action: "DELETE_RECORDING", targetId: rec.id, reason } })
  return NextResponse.json({ success: true })
}
