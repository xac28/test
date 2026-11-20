import { db } from "@/lib/db"
import { notifyAdminsInApp } from "@/lib/notifications"
import { logEvent } from "@/lib/event-log"
import { serializeRoomSettings, DEFAULT_ROOM_SETTINGS } from "@/lib/live-chat"

/**
 * Trial-phase teachers ("deneme öğretmeni") may go live, but every one of their broadcasts is *supervised*:
 * officials are told the moment it starts, can watch it unseen (hidden participant), speak to the teacher or to the
 * room, tighten the chat, end the broadcast, and approve or reject the teacher from the same screen.
 */

export type TeacherStatus = "approved" | "trial"
export const teacherStatus = (isTrialMode: boolean): TeacherStatus => (isTrialMode ? "trial" : "approved")

export const STATUS_LABEL_TR: Record<TeacherStatus, string> = { approved: "Onaylı öğretmen", trial: "Deneme öğretmeni" }
export const STATUS_HINT_TR: Record<TeacherStatus, string> = {
  approved: "AYA ekibi tarafından incelenip onaylanmış eğitmen.",
  trial: "Deneme sürecinde: yayınları yetkililer tarafından canlı izlenir.",
}

/** The chat is stricter while a trial teacher is on air: a short slow mode from the first second. */
export const SUPERVISED_SLOW_MODE_SEC = 5
export const supervisedRoomMetadata = (title: string) => serializeRoomSettings({ ...DEFAULT_ROOM_SETTINGS, title, slowModeSec: SUPERVISED_SLOW_MODE_SEC })

/** Tells every admin (bell + system log) that a trial teacher is live. Never throws. */
export async function announceSupervisedStart(room: { id: string; title: string }, teacher: { userId: string; user?: { name: string | null } | null }) {
  try {
    const name = teacher.user?.name ?? (await db.user.findUnique({ where: { id: teacher.userId }, select: { name: true } }))?.name ?? "Bir eğitmen"
    await notifyAdminsInApp("Deneme öğretmeni yayında", `${name} deneme sürecinde “${room.title}” yayınını başlattı. Canlı izleyebilirsiniz.`, `/admin/izle/${room.id}`)
    await logEvent({ type: "LIVE", level: "warn", message: `Denetimli yayın başladı: ${name} — ${room.title}`, userId: teacher.userId, meta: { liveRoomId: room.id } })
  } catch {
    /* the broadcast must start even if the alert fails */
  }
}
