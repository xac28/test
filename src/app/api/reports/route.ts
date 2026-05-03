import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"

export async function POST(req: Request) {
  try {
    const user = await resolveUser(req)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { reportedId, bookingId, reason } = await req.json()

    if (!reason) {
      return NextResponse.json({ error: "Reason is required" }, { status: 400 })
    }

    const report = await db.report.create({
      data: {
        reporterId: user.id,
        reportedId: reportedId || null,
        bookingId: bookingId || null,
        reason,
      }
    })

    return NextResponse.json({ success: true, report })
  } catch (error: any) {
    console.error("[REPORT_CREATE_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}
