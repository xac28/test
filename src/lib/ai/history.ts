import { AI_LIMITS } from "@/lib/ai/config"
import type { ChatMsg } from "@/lib/ai/agent"

/** Turns whatever the browser sent into a safe conversation: at most N turns, trimmed, starting and ending with the user. */
export function cleanHistory(raw: unknown): ChatMsg[] | null {
  if (!Array.isArray(raw)) return null
  const out: ChatMsg[] = []
  for (const m of raw.slice(-AI_LIMITS.maxHistory)) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") continue
    const content = m.content.replace(/\u0000/g, "").trim().slice(0, m.role === "user" ? AI_LIMITS.maxUserChars : AI_LIMITS.maxAssistantChars)
    if (content) out.push({ role: m.role, content })
  }
  while (out.length && out[0].role !== "user") out.shift()
  if (!out.length || out[out.length - 1].role !== "user") return null
  return out
}

/** Only an internal path of the site (never a URL the browser could be sent elsewhere with). */
export const cleanPage = (raw: unknown): string | undefined => (typeof raw === "string" && /^\/[a-z0-9/_\-.]{0,80}$/i.test(raw) ? raw : undefined)
