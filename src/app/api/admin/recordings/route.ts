import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { requireAdmin, pageOf } from "@/lib/admin-api"

export const dynamic = "force-dynamic"

// GET /api/admin/recordings?status=&page= — metadata only; admins cannot download lesson recordings
export async function GET(req: Request) {
  const g = await requireAdmin(req)
  if ("response" in g) return g.response
  const url = new URL(req.url)
  const status = url.searchParams.get("status") || "all"
  const { page, size, skip } = pageOf(url)
  const where: any = {}
  if (["RECORDING", "READY", "FAILED", "EXPIRED"].includes(status)) where.status = status
  const [rows, total, agg] = await Promise.all([
    db.lessonRecording.findMany({ where, orderBy: { startedAt: "desc" }, skip, take: size }),
    db.lessonRecording.count({ where }),
    db.lessonRecording.aggregate({ where: { deletedAt: null }, _sum: { sizeBytes: true }, _count: { _all: true } }),
  ])
  const userIds = Array.from(new Set(rows.flatMap((r) => [r.teacherUserId, r.studentUserId]).filter(Boolean) as string[]))
  const users = userIds.length ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : []
  const names = new Map(users.map((u) => [u.id, u.name]))
  return NextResponse.json({
    recordings: rows.map((r) => ({
      id: r.id, roomName: r.roomName, status: r.status, sizeBytes: Number(r.sizeBytes), durationSec: r.durationSec, startedAt: r.startedAt,
      expiresAt: r.expiresAt, deletedAt: r.deletedAt, kind: r.bookingId ? "Ders" : "Canlı yayın",
      teacher: names.get(r.teacherUserId) ?? null, student: r.studentUserId ? names.get(r.studentUserId) ?? null : null,
    })),
    total, page, pageSize: size,
    storage: { files: agg._count._all, bytes: Number(agg._sum.sizeBytes ?? 0) },
  })
}
