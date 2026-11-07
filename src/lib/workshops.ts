/** Workshop (Atölye) rules: state, seats, enrollment, validation. Pure and unit-tested. */

export const WORKSHOP_CATEGORIES = [
  "Hatha", "Vinyasa", "Yin", "Restoratif", "Nefes", "Meditasyon", "Yoga Nidra", "Hamile Yogası", "Yüz Yogası", "Felsefe",
] as const

export const WORKSHOP_LEVELS = ["Tüm seviyeler", "Başlangıç", "Orta", "İleri"] as const

/** How long before the start the "join" button appears. */
export const JOIN_WINDOW_MIN = 15

export type WorkshopMode = "LIVE" | "RECORDED"
export type WorkshopStatus = "DRAFT" | "PUBLISHED" | "CANCELLED"
export type EnrollmentStatus = "RESERVED" | "CONFIRMED" | "CANCELLED"

export interface WorkshopLike {
  mode: WorkshopMode
  status: WorkshopStatus
  startsAt: Date | string | null
  durationMin: number
  capacity: number
  priceUsd: number
}

export type WorkshopState = "draft" | "cancelled" | "recorded" | "upcoming" | "starting-soon" | "ongoing" | "ended"

export function workshopState(w: WorkshopLike, now: Date = new Date()): WorkshopState {
  if (w.status === "DRAFT") return "draft"
  if (w.status === "CANCELLED") return "cancelled"
  if (w.mode === "RECORDED") return "recorded"
  if (!w.startsAt) return "upcoming"
  const start = new Date(w.startsAt).getTime()
  const end = start + w.durationMin * 60_000
  const t = now.getTime()
  if (t >= end) return "ended"
  if (t >= start) return "ongoing"
  if (start - t <= JOIN_WINDOW_MIN * 60_000) return "starting-soon"
  return "upcoming"
}

/** Seats taken by RESERVED and CONFIRMED enrollments (cancelled ones free the seat). */
export function seatsLeft(capacity: number, enrollments: { status: string }[]): number {
  const taken = enrollments.filter((e) => e.status === "RESERVED" || e.status === "CONFIRMED").length
  return Math.max(0, capacity - taken)
}

export function initialEnrollmentStatus(priceUsd: number): EnrollmentStatus {
  return priceUsd > 0 ? "RESERVED" : "CONFIRMED"
}

export type EnrollCheck = { ok: true } | { ok: false; code: string; error: string }

export function canEnroll(
  w: WorkshopLike,
  opts: { now?: Date; seatsLeft: number; existing?: { status: string } | null; isOwner?: boolean }
): EnrollCheck {
  const state = workshopState(w, opts.now)
  if (opts.isOwner) return { ok: false, code: "OWNER", error: "Kendi atölyenize kayıt olamazsınız." }
  if (state === "draft" || state === "cancelled") return { ok: false, code: "UNAVAILABLE", error: "Bu atölye kayıt almıyor." }
  if (state === "ended") return { ok: false, code: "ENDED", error: "Bu atölye sona erdi." }
  if (opts.existing && opts.existing.status !== "CANCELLED") {
    return { ok: false, code: "ALREADY", error: "Bu atölyeye zaten kayıtlısınız." }
  }
  if (opts.seatsLeft <= 0) return { ok: false, code: "FULL", error: "Kontenjan doldu." }
  return { ok: true }
}

/** The recorded video / live stream is only for the owner, admins and confirmed enrollees. */
export function canAccessContent(opts: { isOwner: boolean; isAdmin: boolean; enrollmentStatus?: string | null }): boolean {
  return opts.isOwner || opts.isAdmin || opts.enrollmentStatus === "CONFIRMED"
}

export interface WorkshopInput {
  title?: unknown
  subtitle?: unknown
  description?: unknown
  category?: unknown
  level?: unknown
  mode?: unknown
  startsAt?: unknown
  durationMin?: unknown
  priceUsd?: unknown
  capacity?: unknown
  coverUrl?: unknown
  videoUrl?: unknown
}

export type WorkshopValidation =
  | {
      ok: true
      data: {
        title: string
        subtitle: string | null
        description: string
        category: string
        level: string
        mode: WorkshopMode
        startsAt: Date | null
        durationMin: number
        priceUsd: number
        capacity: number
        coverUrl: string | null
        videoUrl: string | null
      }
    }
  | { ok: false; error: string }

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")
const isHttpOrLocal = (u: string) => /^https?:\/\//i.test(u) || u.startsWith("/uploads/")

export function validateWorkshopInput(input: WorkshopInput, now: Date = new Date()): WorkshopValidation {
  const title = str(input.title)
  if (title.length < 4 || title.length > 160) return { ok: false, error: "Başlık 4–160 karakter olmalı." }
  const description = str(input.description)
  if (description.length < 30) return { ok: false, error: "Açıklama en az 30 karakter olmalı." }
  if (description.length > 8000) return { ok: false, error: "Açıklama çok uzun." }
  const category = str(input.category)
  if (!category || category.length > 60) return { ok: false, error: "Kategori seçin." }
  const level = str(input.level) || "Tüm seviyeler"
  if (!(WORKSHOP_LEVELS as readonly string[]).includes(level)) return { ok: false, error: "Geçersiz seviye." }
  const mode: WorkshopMode = input.mode === "RECORDED" ? "RECORDED" : "LIVE"

  const durationMin = Number(input.durationMin ?? 60)
  if (!Number.isInteger(durationMin) || durationMin < 10 || durationMin > 480) {
    return { ok: false, error: "Süre 10–480 dakika olmalı." }
  }
  const priceUsd = Number(input.priceUsd ?? 0)
  if (!Number.isFinite(priceUsd) || priceUsd < 0 || priceUsd > 1000) return { ok: false, error: "Fiyat 0–1000 USD olmalı." }
  const capacity = Number(input.capacity ?? 20)
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) return { ok: false, error: "Kontenjan 1–500 olmalı." }

  let startsAt: Date | null = null
  if (mode === "LIVE") {
    startsAt = new Date(String(input.startsAt ?? ""))
    if (isNaN(startsAt.getTime())) return { ok: false, error: "Başlangıç tarihi geçersiz." }
    if (startsAt.getTime() < now.getTime() - 5 * 60_000) return { ok: false, error: "Başlangıç tarihi geçmişte olamaz." }
  }

  const coverUrl = str(input.coverUrl) || null
  if (coverUrl && !isHttpOrLocal(coverUrl)) return { ok: false, error: "Kapak görseli bağlantısı geçersiz." }
  const videoUrl = str(input.videoUrl) || null
  if (videoUrl && !isHttpOrLocal(videoUrl)) return { ok: false, error: "Video bağlantısı geçersiz." }
  if (mode === "RECORDED" && !videoUrl) return { ok: false, error: "Kayıtlı atölye için video bağlantısı gerekli." }

  const subtitle = str(input.subtitle).slice(0, 240) || null
  return {
    ok: true,
    data: {
      title,
      subtitle,
      description,
      category,
      level,
      mode,
      startsAt,
      durationMin,
      priceUsd: Math.round(priceUsd * 100) / 100,
      capacity,
      coverUrl,
      videoUrl: mode === "RECORDED" ? videoUrl : null,
    },
  }
}

export function formatPriceTR(priceUsd: number): string {
  return priceUsd > 0 ? `$${priceUsd.toFixed(priceUsd % 1 === 0 ? 0 : 2)}` : "Ücretsiz"
}

export const STATE_LABEL_TR: Record<WorkshopState, string> = {
  draft: "Taslak",
  cancelled: "İptal edildi",
  recorded: "Kayıtlı",
  upcoming: "Yaklaşan",
  "starting-soon": "Birazdan başlıyor",
  ongoing: "Şimdi canlı",
  ended: "Sona erdi",
}
