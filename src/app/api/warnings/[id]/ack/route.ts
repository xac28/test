import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"

// POST /api/warnings/:id/ack — "I have read this"
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const res = await db.userWarning.updateMany({
    where: { id: params.id, userId: user.id, acknowledgedAt: null },
    data: { acknowledgedAt: new Date() },
  })
  if (res.count === 0) return NextResponse.json({ error: "Uyarı bulunamadı" }, { status: 404 })
  return NextResponse.json({ success: true })
}
