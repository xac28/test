/**
 * Scheduled publishing: a draft with a future `scheduledAt` goes live by itself (cron job /api/cron/publish).
 * The helpers are used by the three admin APIs (articles, podcast, products) and by the editors.
 */

export const MAX_AHEAD_DAYS = 365

export type ScheduleResult = { ok: true; value: Date | null } | { ok: false; error: string }

/** An ISO date (or empty) from the editor: must be a real date, not in the past, at most a year ahead. */
export function parseSchedule(raw: unknown, now = new Date()): ScheduleResult {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: null }
  if (typeof raw !== "string" && !(raw instanceof Date)) return { ok: false, error: "Yayın zamanı geçersiz." }
  const d = raw instanceof Date ? raw : new Date(raw)
  if (Number.isNaN(d.getTime())) return { ok: false, error: "Yayın zamanı geçersiz." }
  if (d.getTime() < now.getTime() - 60_000) return { ok: false, error: "Yayın zamanı geçmişte olamaz." }
  if (d.getTime() > now.getTime() + MAX_AHEAD_DAYS * 86_400_000) return { ok: false, error: "Yayın zamanı en fazla 1 yıl sonrası olabilir." }
  return { ok: true, value: d }
}

export type ScheduleData = { scheduledAt: Date | null; scheduledNotify: boolean }

/**
 * What to store for a save. Publishing now (or unpublishing) clears the schedule; a draft keeps its schedule unless the
 * request changes it (`scheduledAt: null` cancels it). `notify` says whether the subscribers are told at that time.
 */
export function scheduleData(
  body: { scheduledAt?: unknown; notify?: unknown },
  status: "DRAFT" | "PUBLISHED",
  existing?: { scheduledAt: Date | null; scheduledNotify: boolean },
  now = new Date(),
  unpublishing = false,
): { ok: true; data: ScheduleData } | { ok: false; error: string } {
  if (status === "PUBLISHED") return { ok: true, data: { scheduledAt: null, scheduledNotify: false } }
  const has = Object.prototype.hasOwnProperty.call(body, "scheduledAt")
  if (!has) {
    // taking a live item back to draft also drops an old schedule; editing a scheduled draft keeps it
    if (unpublishing || !existing?.scheduledAt) return { ok: true, data: { scheduledAt: null, scheduledNotify: false } }
    return { ok: true, data: { scheduledAt: existing.scheduledAt, scheduledNotify: body.notify === true || (body.notify === undefined && existing.scheduledNotify) } }
  }
  const p = parseSchedule(body.scheduledAt, now)
  if (!p.ok) return p
  return { ok: true, data: { scheduledAt: p.value, scheduledNotify: p.value ? body.notify === true : false } }
}

/** `<input type="datetime-local">` value (browser time) ← ISO string */
export function toLocalInput(iso: string | Date | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** ISO string ← `<input type="datetime-local">` value (browser time); empty stays empty */
export function fromLocalInput(v: string): string | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export const formatSchedule = (iso: string | Date | null | undefined) =>
  iso ? new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""
