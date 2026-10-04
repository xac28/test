import { db } from "@/lib/db"
import { CONTACT_LABEL_TR, ContactKind, KIND_LABEL_TR, ProfanityKind, findContact, findSpamShape, maskText, scanText } from "@/lib/profanity"
import { notify, notifyAdminsInApp } from "@/lib/notifications"
import { notifyAdmins } from "@/lib/report-server"
import { sanitizeReportText } from "@/lib/reports"

export type Surface = "POST" | "COMMENT" | "MESSAGE" | "LIVE_CHAT" | "REVIEW"

/** Violations in the last hour that earn a short mute, and in the last day that earn a long one + an official warning. */
export const HOURLY_STRIKES_FOR_MUTE = 3
export const DAILY_STRIKES_FOR_LONG_MUTE = 6
export const SHORT_MUTE_MIN = 15
export const LONG_MUTE_MIN = 24 * 60
const MAX_COMMENTS_PER_2MIN = 8
const DUPLICATE_WINDOW_MS = 5 * 60_000

// admins' extra words, cached for a minute
let wordCache: { at: number; words: string[] } | null = null
export async function blockedWords(): Promise<string[]> {
  if (wordCache && Date.now() - wordCache.at < 60_000) return wordCache.words
  const rows = await db.blockedWord.findMany({ select: { word: true } })
  wordCache = { at: Date.now(), words: rows.map((r) => r.word) }
  return wordCache.words
}
export const clearWordCache = () => { wordCache = null }

export interface Blocked {
  ok: false
  status: number
  code: "PROFANITY" | "CONTACT" | "SPAM" | "FLOOD" | "DUPLICATE" | "MUTED" | "EMPTY" | "TOO_LONG"
  error: string
  /** human hint about the consequence, if any */
  strikes?: { hour: number; muted?: boolean }
}
export type Allowed = { ok: true; text: string }

const KIND_FOR_ERROR: Record<string, string> = { PROFANITY: "PROFANITY", INSULT: "PROFANITY", HATE: "PROFANITY", THREAT: "PROFANITY", SPAM: "SPAM" }

export async function activeMute(userId: string): Promise<{ until: Date; reason: string } | null> {
  const m = await db.communityMute.findFirst({ where: { userId, until: { gt: new Date() } }, orderBy: { until: "desc" } })
  return m ? { until: m.until, reason: m.reason } : null
}

async function record(userId: string, kind: string, surface: Surface, text: string, extra: string[]) {
  await db.moderationEvent.create({ data: { userId, kind, surface, excerpt: maskText(text, extra).slice(0, 160) } }).catch(() => {})
}

/** Counts this user's recent violations and applies the consequences. Returns what happened. */
async function applyStrikes(userId: string): Promise<{ hour: number; muted: boolean }> {
  const now = Date.now()
  const [hour, day] = await Promise.all([
    db.moderationEvent.count({ where: { userId, createdAt: { gte: new Date(now - 3_600_000) }, kind: { in: ["PROFANITY", "SPAM", "CONTACT_INFO", "LINK"] } } }),
    db.moderationEvent.count({ where: { userId, createdAt: { gte: new Date(now - 86_400_000) }, kind: { in: ["PROFANITY", "SPAM", "CONTACT_INFO", "LINK"] } } }),
  ])
  let minutes = 0
  let reason = ""
  if (day >= DAILY_STRIKES_FOR_LONG_MUTE) {
    minutes = LONG_MUTE_MIN
    reason = "Bir gün içinde çok sayıda kural ihlali"
  } else if (hour >= HOURLY_STRIKES_FOR_MUTE) {
    minutes = SHORT_MUTE_MIN
    reason = "Kısa sürede tekrarlanan kural ihlali"
  }
  if (!minutes) return { hour, muted: false }
  const already = await activeMute(userId)
  if (already && already.until.getTime() >= now + minutes * 60_000 - 1000) return { hour, muted: true }
  await db.communityMute.create({ data: { userId, until: new Date(now + minutes * 60_000), reason } })
  await notify({
    userId, type: "MUTED", title: minutes >= 60 ? "Bir gün boyunca yorum ve paylaşım yapamazsın" : `${minutes} dakika yorum yapamazsın`,
    body: "Topluluk kurallarına aykırı içerik denemeleri nedeniyle geçici olarak kısıtlandın. Süre dolunca tekrar katılabilirsin.", href: "/community/rules",
  })
  if (minutes === LONG_MUTE_MIN) {
    const u = await db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } })
    await db.userWarning.create({ data: { userId, issuedById: "system", message: "Topluluk kurallarını tekrar tekrar ihlal ettiğin için hesabın 24 saat boyunca yorum ve paylaşıma kapatıldı. Tekrarında hesabın kalıcı olarak kısıtlanabilir." } })
    await notifyAdminsInApp("Otomatik moderasyon: tekrarlayan ihlal", `${u?.name ?? "Bir kullanıcı"} bir günde ${day} kez engellendi ve 24 saat susturuldu.`, `/admin?tab=community`)
    notifyAdmins("AYA: Tekrarlayan topluluk ihlali", `<p>${(u?.name ?? "Bir kullanıcı").replace(/</g, "&lt;")} (${(u?.email ?? "").replace(/</g, "&lt;")}) bir günde ${day} kez otomatik moderasyona takıldı ve 24 saat susturuldu.</p>`).catch(() => {})
  }
  return { hour, muted: true }
}

const blockMsg = (kind: ProfanityKind) => `Mesajın topluluk kurallarına aykırı bir ifade (${KIND_LABEL_TR[kind]}) içeriyor, bu yüzden yayınlanmadı. Lütfen nazik bir dille yeniden yaz. 🙏`

export async function moderateText(
  user: { id: string; role?: string | null },
  raw: unknown,
  surface: Surface,
  opts: { max?: number; min?: number; skipFlood?: boolean; postId?: string } = {}
): Promise<Allowed | Blocked> {
  const max = opts.max ?? 1000
  const text = sanitizeReportText(raw, max + 1)
  if (text.length < (opts.min ?? 1)) return { ok: false, status: 400, code: "EMPTY", error: "Bir şeyler yazmalısın." }
  if (text.length > max) return { ok: false, status: 400, code: "TOO_LONG", error: `En fazla ${max} karakter yazabilirsin.` }

  const mute = surface === "LIVE_CHAT" ? null : await activeMute(user.id)
  if (mute) {
    const mins = Math.max(1, Math.ceil((mute.until.getTime() - Date.now()) / 60_000))
    return { ok: false, status: 429, code: "MUTED", error: `Şu anda yorum ve paylaşım yapamazsın (${mins >= 90 ? `yaklaşık ${Math.round(mins / 60)} saat` : `${mins} dk`} kaldı). Sebep: ${mute.reason}.` }
  }

  const extra = await blockedWords()
  const scan = scanText(text, extra)
  if (!scan.clean) {
    const main = scan.kinds.find((k) => k !== "SPAM") ?? scan.kinds[0]
    const kind = main === "SPAM" ? "SPAM" : "PROFANITY"
    await record(user.id, KIND_FOR_ERROR[main] === "SPAM" ? "SPAM" : "PROFANITY", surface, text, extra)
    const st = await applyStrikes(user.id)
    return {
      ok: false, status: 422, code: kind === "SPAM" ? "SPAM" : "PROFANITY",
      error: kind === "SPAM" ? "Reklam ve istenmeyen içerik paylaşılamaz." : blockMsg(main),
      strikes: st,
    }
  }

  if (user.role !== "ADMIN") {
    const contact: ContactKind | null = findContact(text)
    if (contact && !(surface === "MESSAGE" && contact === "PHONE")) {
      await record(user.id, contact === "LINK" ? "LINK" : "CONTACT_INFO", surface, text, extra)
      const st = await applyStrikes(user.id)
      return { ok: false, status: 422, code: "CONTACT", error: `Güvenliğin için ${CONTACT_LABEL_TR[contact]} paylaşılamaz; iletişim ve ödemeler AYA üzerinden yapılır.`, strikes: st }
    }
  }

  const shape = findSpamShape(text)
  if (shape) {
    await record(user.id, "SPAM", surface, text, extra)
    const st = await applyStrikes(user.id)
    const msg = shape === "SHOUTING" ? "Lütfen büyük harflerle bağırarak yazma." : shape === "EMOJI_FLOOD" ? "Lütfen emoji yığma." : "Lütfen aynı karakteri/kelimeyi tekrar tekrar yazma."
    return { ok: false, status: 422, code: "SPAM", error: msg, strikes: st }
  }

  if (surface === "COMMENT" && !opts.skipFlood) {
    const [recent, dup] = await Promise.all([
      db.comment.count({ where: { authorId: user.id, createdAt: { gte: new Date(Date.now() - 120_000) } } }),
      db.comment.findFirst({ where: { authorId: user.id, content: text, createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) } }, select: { id: true } }),
    ])
    if (recent >= MAX_COMMENTS_PER_2MIN) return { ok: false, status: 429, code: "FLOOD", error: "Çok hızlı yorum yapıyorsun, birkaç dakika bekle." }
    if (dup) return { ok: false, status: 409, code: "DUPLICATE", error: "Aynı yorumu az önce yazdın." }
  }
  return { ok: true, text }
}

/** Strikes that came from an attempt (not from stored content) are shown to the user as a gentle count. */
export function strikeHint(b: Blocked): string | undefined {
  if (!b.strikes) return undefined
  if (b.strikes.muted) return "Tekrarlayan ihlaller nedeniyle geçici olarak kısıtlandın."
  const left = HOURLY_STRIKES_FOR_MUTE - b.strikes.hour
  return left > 0 ? `Dikkat: ${left} ihlal daha yaparsan ${SHORT_MUTE_MIN} dakika yorum yapamazsın.` : undefined
}
