import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { unreadCount } from "@/lib/notifications"

export const dynamic = "force-dynamic"

// GET /api/notifications?limit=20&cursor=<id>&unread=1 — the signed-in user's notifications, newest first
export async function GET(req: Request) {
  const user = await resolveUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const url = new URL(req.url)
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20") || 20))
  const cursor = url.searchParams.get("cursor")
  const rows = await db.notification.findMany({
    where: { userId: user.id, ...(url.searchParams.get("unread") === "1" ? { readAt: null } : {}) },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })
  const page = rows.slice(0, limit)
  return NextResponse.json({
    notifications: page.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, href: n.href, count: n.count, read: !!n.readAt, createdAt: n.updatedAt })),
    nextCursor: rows.length > limit ? page[page.length - 1].id : null,
    unread: await unreadCount(user.id),
  })
}
