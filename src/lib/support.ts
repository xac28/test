import { sanitizeReportText } from "@/lib/reports"
import { scanText } from "@/lib/profanity"

export const SUPPORT_MAX = 1000
export const SUPPORT_SUBJECT_MAX = 120

export function cleanSupportText(raw: unknown): { ok: true; text: string } | { ok: false; error: string } {
  const text = sanitizeReportText(raw, SUPPORT_MAX + 1)
  if (!text) return { ok: false, error: "Mesaj boş olamaz." }
  if (text.length > SUPPORT_MAX) return { ok: false, error: `En fazla ${SUPPORT_MAX} karakter yazabilirsin.` }
  // staff are people too: abuse is kept out of the support chat as well (contact details are allowed here)
  if (!scanText(text).clean) return { ok: false, error: "Mesajın uygunsuz bir ifade içeriyor. Lütfen nazik bir dille yeniden yaz; sana yardımcı olmak istiyoruz." }
  return { ok: true, text }
}

export const subjectFrom = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, SUPPORT_SUBJECT_MAX)

export function serializeMessage(m: { id: string; role: string; content: string; createdAt: Date; senderId: string | null }) {
  return { id: m.id, role: m.role, content: m.content, createdAt: m.createdAt, senderId: m.senderId }
}

export const SOURCE_LABEL_TR: Record<string, string> = { USER: "Kullanıcı başlattı", AI_UNHELPFUL: "Rehber yardımcı olamadı", AI_REQUEST: "Rehberden istendi" }
