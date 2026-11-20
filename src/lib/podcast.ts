/** Podcast (Konuşmalar) helpers: validation and formatting shared by the admin API, the pages and the RSS feed. */

export interface PodcastInput {
  title?: unknown
  description?: unknown
  audioUrl?: unknown
  coverUrl?: unknown
  guest?: unknown
  durationSec?: unknown
  episodeNo?: unknown
  status?: unknown
  notify?: unknown
}

export type PodcastValidation =
  | { ok: true; data: { title: string; description: string; audioUrl: string; coverUrl: string | null; guest: string | null; durationSec: number | null; episodeNo: number | null; status: "DRAFT" | "PUBLISHED" }; notify: boolean }
  | { ok: false; error: string }

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")
const isUpload = (u: string) => /^\/uploads\/[a-z]+\/[A-Za-z0-9._-]+$/.test(u)
const isHttp = (u: string) => /^https?:\/\/[^\s]+$/i.test(u)

export function validatePodcastInput(input: PodcastInput): PodcastValidation {
  const title = str(input.title)
  if (title.length < 3 || title.length > 200) return { ok: false, error: "Başlık 3–200 karakter olmalı." }
  const description = str(input.description)
  if (description.length < 20) return { ok: false, error: "Açıklama en az 20 karakter olmalı." }
  if (description.length > 8000) return { ok: false, error: "Açıklama çok uzun." }
  const audioUrl = str(input.audioUrl)
  if (!audioUrl || audioUrl.length > 500 || !(isUpload(audioUrl) || isHttp(audioUrl))) return { ok: false, error: "Ses dosyası yükleyin veya geçerli bir bağlantı girin." }
  const coverUrl = str(input.coverUrl) || null
  if (coverUrl && (coverUrl.length > 500 || !(isUpload(coverUrl) || isHttp(coverUrl)))) return { ok: false, error: "Kapak görseli bağlantısı geçersiz." }
  const guest = str(input.guest) || null
  if (guest && guest.length > 120) return { ok: false, error: "Konuk adı çok uzun." }

  const num = (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v))
  const dur = num(input.durationSec)
  if (dur !== null && (!Number.isInteger(dur) || dur < 1 || dur > 24 * 3600)) return { ok: false, error: "Süre saniye cinsinden 1–86400 arası bir sayı olmalı." }
  const no = num(input.episodeNo)
  if (no !== null && (!Number.isInteger(no) || no < 1 || no > 9999)) return { ok: false, error: "Bölüm numarası 1–9999 arası olmalı." }

  return {
    ok: true,
    data: { title, description, audioUrl, coverUrl, guest, durationSec: dur, episodeNo: no, status: input.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT" },
    notify: input.notify === true,
  }
}

/** 3725 → "1:02:05", 185 → "3:05" */
export function formatDuration(sec: number | null | undefined): string {
  if (!sec || sec < 0) return ""
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60)
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m)
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`
}

/** iTunes wants HH:MM:SS */
export const itunesDuration = (sec: number) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":")
}

export const xmlEscape = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string))
