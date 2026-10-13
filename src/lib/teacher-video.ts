import { access } from "fs/promises"
import path from "path"

/**
 * A teacher video is either a file the teacher uploaded through /api/upload (type=video) or an https link.
 * Anything else (javascript:, data:, other people's files) is refused: the link is rendered on a public profile.
 */
export async function validateVideoUrl(raw: unknown, userId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (typeof raw !== "string") return { ok: false, error: "Video bağlantısı gerekli." }
  const url = raw.trim()
  if (url.length > 500) return { ok: false, error: "Video bağlantısı çok uzun." }
  if (url.startsWith("/uploads/")) {
    const m = /^\/uploads\/videos\/(video-([A-Za-z0-9]+)-\d+\.(?:mp4|webm|ogg|ogv|mov))$/i.exec(url)
    if (!m || m[2] !== userId) return { ok: false, error: "Yalnızca kendi yüklediğin videoları ekleyebilirsin." }
    try {
      await access(path.join(process.cwd(), "public", "uploads", "videos", m[1]))
    } catch {
      return { ok: false, error: "Yüklenen dosya bulunamadı; videoyu yeniden yükle." }
    }
    return { ok: true, url }
  }
  try {
    const u = new URL(url)
    if (u.protocol !== "https:") return { ok: false, error: "Bağlantı https:// ile başlamalı." }
    return { ok: true, url: u.toString() }
  } catch {
    return { ok: false, error: "Geçerli bir video bağlantısı girin." }
  }
}
