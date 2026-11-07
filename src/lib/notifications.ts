import { db } from "@/lib/db"

export type NotificationType =
  | "POST_LIKE" | "POST_COMMENT" | "POST_APPROVED" | "POST_REMOVED" | "COMMENT_REMOVED"
  | "WARNING" | "REPORT_UPDATE" | "MUTED" | "SUPPORT_REPLY" | "SYSTEM"

export interface NotifyInput {
  userId: string
  type: NotificationType
  title: string
  body?: string | null
  href?: string | null
  /** the person who caused it; nobody is notified about their own actions */
  actorId?: string | null
  /** unread notifications with the same key merge into one ("3 kişi gönderini beğendi") */
  groupKey?: string
  /** title for a merged notification, given how many events it now stands for */
  groupTitle?: (count: number) => string
  /** also send a push to the user's phone (mobile app) */
  push?: boolean
}

/** Expo push, best effort: a failed push never breaks the action that caused it. */
export async function sendPush(token: string | null | undefined, title: string, body: string | undefined, href?: string | null) {
  if (!token || !/^Expo(nent)?PushToken\[/.test(token)) return
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ to: token, title, body, data: { href }, sound: "default" }),
      signal: AbortSignal.timeout(4000),
    })
  } catch {
    /* offline / blocked */
  }
}

export async function notify(n: NotifyInput): Promise<void> {
  try {
    if (n.actorId && n.actorId === n.userId) return
    const body = n.body ? n.body.slice(0, 400) : null
    if (n.groupKey) {
      const existing = await db.notification.findFirst({ where: { userId: n.userId, groupKey: n.groupKey, readAt: null }, orderBy: { createdAt: "desc" } })
      if (existing) {
        const count = existing.count + 1
        await db.notification.update({
          where: { id: existing.id },
          data: { count, title: (n.groupTitle ? n.groupTitle(count) : n.title).slice(0, 160), actorId: n.actorId ?? existing.actorId },
        })
        return
      }
    }
    await db.notification.create({
      data: {
        userId: n.userId, type: n.type, title: n.title.slice(0, 160), body, href: n.href ?? null, actorId: n.actorId ?? null,
        groupKey: n.groupKey ?? null, count: 1,
      },
    })
    if (n.push !== false) {
      const u = await db.user.findUnique({ where: { id: n.userId }, select: { expoPushToken: true } })
      if (u?.expoPushToken) sendPush(u.expoPushToken, n.title, body ?? undefined, n.href)
    }
  } catch (e) {
    console.error("[NOTIFY_ERROR]", (e as Error).message)
  }
}

export async function notifyAdminsInApp(title: string, body: string, href: string) {
  try {
    const admins = await db.user.findMany({ where: { role: "ADMIN", banned: false }, select: { id: true } })
    for (const a of admins) await notify({ userId: a.id, type: "SYSTEM", title, body, href, push: false })
  } catch {}
}

export async function unreadCount(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } })
}
