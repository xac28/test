import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"

// POST /api/notifications/push-token { token } — the mobile app registers its Expo push token (DELETE forgets it)
export async function POST(req: Request) {
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { token } = await req.json().catch(() => ({}))
  if (typeof token !== "string" || !/^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$/.test(token)) return NextResponse.json({ error: "Geçersiz token" }, { status: 400 })
  await db.user.update({ where: { id: user.id }, data: { expoPushToken: token } })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  await db.user.update({ where: { id: user.id }, data: { expoPushToken: null } })
  return NextResponse.json({ success: true })
}
