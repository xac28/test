import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { termsGate } from "@/lib/terms"
import { createReport } from "@/lib/report-server"
import { CATEGORY_LABEL_TR, REPORTER_STATUS_MESSAGE_TR, STATUS_LABEL_TR, TARGET_LABEL_TR } from "@/lib/reports"

export const dynamic = "force-dynamic"

// POST /api/reports { targetType, targetId, category, description, message? } — file a report (web + mobile)
export async function POST(req: Request) {
  try {
    const user = await resolveUser(req)
    if (!user) return NextResponse.json({ error: "Bildirim göndermek için giriş yapın." }, { status: 401 })
    const termsBlock = termsGate(user)
    if (termsBlock) return termsBlock

    const body = await req.json().catch(() => ({}))
    const result = await createReport(user, body)
    if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status })
    return NextResponse.json({ success: true, id: result.id })
  } catch (error) {
    console.error("[REPORT_CREATE_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}

// GET /api/reports — the signed-in user's own reports and where they stand (never internal notes)
export async function GET(req: Request) {
  try {
    const user = await resolveUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const rows = await db.report.findMany({
      where: { reporterId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, category: true, targetType: true, status: true, createdAt: true, updatedAt: true, reason: true },
    })
    return NextResponse.json({
      reports: rows.map((r) => ({
        id: r.id,
        category: r.category,
        categoryLabel: CATEGORY_LABEL_TR(r.category),
        targetLabel: TARGET_LABEL_TR[r.targetType] ?? r.targetType,
        status: r.status,
        statusLabel: STATUS_LABEL_TR[r.status],
        message: REPORTER_STATUS_MESSAGE_TR[r.status],
        description: r.reason,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    })
  } catch (error) {
    console.error("[REPORT_LIST_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}
