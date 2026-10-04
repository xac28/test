/**
 * Report (şikayet / bildirim) rules: categories per target, priority, escalation, spam limits.
 * Pure and unit-tested; the server glue lives in report-server.ts.
 */

export type TargetType = "TEACHER" | "LIVE_ROOM" | "WORKSHOP" | "BOOKING" | "CHAT_MESSAGE"
export type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT"
export type ReportStatus = "PENDING" | "REVIEWED" | "RESOLVED" | "DISMISSED"

export const TARGET_TYPES: TargetType[] = ["TEACHER", "LIVE_ROOM", "WORKSHOP", "BOOKING", "CHAT_MESSAGE"]

export const TARGET_LABEL_TR: Record<string, string> = {
  TEACHER: "Eğitmen",
  LIVE_ROOM: "Canlı yayın",
  WORKSHOP: "Atölye",
  BOOKING: "Ders",
  CHAT_MESSAGE: "Sohbet mesajı",
  USER: "Kullanıcı",
}

interface CategoryDef {
  label: string
  hint: string
  base: Priority
  targets: TargetType[]
}

export const REPORT_CATEGORIES: Record<string, CategoryDef> = {
  SAFETY: { label: "Güvenlik / zarar riski", hint: "Fiziksel veya psikolojik zarar riski, tehlikeli yönlendirme", base: "HIGH", targets: ["TEACHER", "LIVE_ROOM", "WORKSHOP", "BOOKING", "CHAT_MESSAGE"] },
  HARASSMENT: { label: "Taciz / uygunsuz davranış", hint: "Hakaret, taciz, ayrımcılık, uygunsuz dil", base: "HIGH", targets: ["TEACHER", "LIVE_ROOM", "BOOKING", "CHAT_MESSAGE"] },
  INAPPROPRIATE_CONTENT: { label: "Uygunsuz içerik", hint: "Yoga/meditasyonla ilgisiz, müstehcen veya rahatsız edici içerik", base: "HIGH", targets: ["TEACHER", "LIVE_ROOM", "WORKSHOP", "CHAT_MESSAGE"] },
  FRAUD: { label: "Aldatma / dolandırıcılık", hint: "Sahte bilgi, platform dışına ödeme yönlendirme, yanıltıcı vaatler", base: "HIGH", targets: ["TEACHER", "WORKSHOP", "BOOKING", "CHAT_MESSAGE"] },
  RECORDING_VIOLATION: { label: "Kayıt / paylaşım ihlali", hint: "Dersin izinsiz kaydedilmesi veya paylaşılması", base: "HIGH", targets: ["TEACHER", "LIVE_ROOM", "BOOKING", "CHAT_MESSAGE"] },
  NO_SHOW: { label: "Derse gelmedi / geç kaldı", hint: "Planlanan derse katılmadı veya çok geç katıldı", base: "NORMAL", targets: ["BOOKING", "WORKSHOP"] },
  QUALITY: { label: "Ders kalitesi / yetersiz eğitmen", hint: "Vaat edilenle uyuşmayan veya yetersiz ders", base: "NORMAL", targets: ["TEACHER", "WORKSHOP", "BOOKING", "LIVE_ROOM"] },
  SPAM: { label: "Spam / reklam", hint: "Tekrarlayan mesajlar, istenmeyen reklam", base: "LOW", targets: ["LIVE_ROOM", "CHAT_MESSAGE", "WORKSHOP"] },
  TECHNICAL: { label: "Teknik sorun", hint: "Görüntü/ses, bağlantı veya platform hatası", base: "LOW", targets: ["LIVE_ROOM", "BOOKING", "WORKSHOP"] },
  OTHER: { label: "Diğer", hint: "Yukarıdakilere uymayan durumlar", base: "NORMAL", targets: ["TEACHER", "LIVE_ROOM", "WORKSHOP", "BOOKING", "CHAT_MESSAGE"] },
}

export const CATEGORY_LABEL_TR = (c: string) => REPORT_CATEGORIES[c]?.label ?? c

export function categoriesFor(target: TargetType): { id: string; label: string; hint: string }[] {
  return Object.entries(REPORT_CATEGORIES)
    .filter(([, d]) => d.targets.includes(target))
    .map(([id, d]) => ({ id, label: d.label, hint: d.hint }))
}

export const MIN_DESCRIPTION = 10
export const MAX_DESCRIPTION = 1500
export const ESCALATION_WINDOW_DAYS = 14
/** This many different reporters against the same user inside the window → URGENT. */
export const ESCALATION_THRESHOLD = 3
export const MAX_REPORTS_PER_HOUR = 5
export const MAX_REPORTS_PER_DAY = 15
/** The same reporter cannot report the same target again while an earlier report is still open. */
export const DUPLICATE_WINDOW_HOURS = 24

export function sanitizeReportText(raw: unknown, max = MAX_DESCRIPTION): string {
  if (typeof raw !== "string") return ""
  return raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f​-‏‪-‮⁦-⁩]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max)
}

export interface ReportInput {
  targetType?: unknown
  targetId?: unknown
  category?: unknown
  description?: unknown
  /** CHAT_MESSAGE only: what the reporter saw (kept as evidence, flagged as reporter-supplied) */
  message?: unknown
}

export type ReportValidation =
  | { ok: true; data: { targetType: TargetType; targetId: string; category: string; description: string; message: { text: string; senderIdentity: string; senderName: string; sentAt: number } | null } }
  | { ok: false; error: string }

export function validateReportInput(input: ReportInput): ReportValidation {
  const targetType = input.targetType as TargetType
  if (!TARGET_TYPES.includes(targetType)) return { ok: false, error: "Geçersiz bildirim türü." }
  const targetId = typeof input.targetId === "string" ? input.targetId.trim() : ""
  if (!targetId || targetId.length > 64) return { ok: false, error: "Bildirilecek içerik belirtilmedi." }
  const category = typeof input.category === "string" ? input.category : ""
  const def = REPORT_CATEGORIES[category]
  if (!def || !def.targets.includes(targetType)) return { ok: false, error: "Lütfen geçerli bir kategori seçin." }
  const description = sanitizeReportText(input.description)
  if (description.length < MIN_DESCRIPTION) return { ok: false, error: `Lütfen durumu en az ${MIN_DESCRIPTION} karakterle açıklayın.` }

  let message = null
  if (targetType === "CHAT_MESSAGE") {
    const m = (input.message ?? {}) as Record<string, unknown>
    const text = sanitizeReportText(m.text, 400)
    const senderIdentity = typeof m.senderIdentity === "string" ? m.senderIdentity.slice(0, 64) : ""
    if (!text || !senderIdentity) return { ok: false, error: "Mesaj bilgisi eksik." }
    message = {
      text,
      senderIdentity,
      senderName: sanitizeReportText(m.senderName, 60) || "Katılımcı",
      sentAt: Number.isFinite(Number(m.sentAt)) ? Number(m.sentAt) : Date.now(),
    }
  }
  return { ok: true, data: { targetType, targetId, category, description, message } }
}

const ORDER: Priority[] = ["LOW", "NORMAL", "HIGH", "URGENT"]

/** Category base priority, raised by the number of different people reporting the same user. */
export function computePriority(category: string, distinctReporters: number): Priority {
  const base = REPORT_CATEGORIES[category]?.base ?? "NORMAL"
  if (distinctReporters >= ESCALATION_THRESHOLD) return "URGENT"
  if (distinctReporters === ESCALATION_THRESHOLD - 1) return ORDER[Math.min(ORDER.indexOf(base) + 1, ORDER.length - 1)]
  return base
}

export const PRIORITY_RANK: Record<string, number> = { LOW: 0, NORMAL: 1, HIGH: 2, URGENT: 3 }
export const PRIORITY_LABEL_TR: Record<string, string> = { LOW: "Düşük", NORMAL: "Normal", HIGH: "Yüksek", URGENT: "Acil" }

export const STATUS_LABEL_TR: Record<string, string> = {
  PENDING: "Yeni",
  REVIEWED: "İnceleniyor",
  RESOLVED: "Sonuçlandı",
  DISMISSED: "Geçersiz sayıldı",
}

/** What the reporter is told — deliberately generic, never the admin's internal notes. */
export const REPORTER_STATUS_MESSAGE_TR: Record<string, string> = {
  PENDING: "Bildiriminiz alındı ve sıraya girdi.",
  REVIEWED: "Bildiriminiz bir yönetici tarafından inceleniyor.",
  RESOLVED: "Bildiriminiz incelendi ve gerekli işlem yapıldı. Teşekkür ederiz.",
  DISMISSED: "Bildiriminiz incelendi; mevcut bilgilerle bir ihlal tespit edilemedi.",
}

export const OPEN_STATUSES: ReportStatus[] = ["PENDING", "REVIEWED"]
export const isOpen = (s: string) => s === "PENDING" || s === "REVIEWED"

export function canTransition(from: string, to: string): boolean {
  if (from === to) return false
  return ["PENDING", "REVIEWED", "RESOLVED", "DISMISSED"].includes(to)
}

export function withinRateLimit(counts: { lastHour: number; lastDay: number }): { ok: true } | { ok: false; error: string } {
  if (counts.lastHour >= MAX_REPORTS_PER_HOUR) return { ok: false, error: "Çok sık bildirim gönderiyorsunuz. Lütfen bir saat sonra tekrar deneyin." }
  if (counts.lastDay >= MAX_REPORTS_PER_DAY) return { ok: false, error: "Günlük bildirim sınırına ulaştınız." }
  return { ok: true }
}

export type AdminAction = "warn" | "ban" | "revoke_teacher" | "close_room" | "unpublish_workshop"
export const ADMIN_ACTION_LABEL_TR: Record<AdminAction, string> = {
  warn: "Uyarı gönderildi",
  ban: "Kullanıcı yasaklandı",
  revoke_teacher: "Eğitmen onayı kaldırıldı",
  close_room: "Canlı yayın kapatıldı",
  unpublish_workshop: "Atölye yayından kaldırıldı",
}
