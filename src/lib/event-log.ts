import { db } from "@/lib/db"

export type EventType =
  | "AUTH_LOGIN" | "AUTH_FAIL" | "AUTH_REGISTER" | "UPLOAD" | "AI_UNKNOWN" | "AI_FEEDBACK" | "SUPPORT"
  | "PAYMENT" | "LIVE" | "SECURITY" | "API_ERROR" | "SYSTEM"

/** Best-effort structured log for the admin viewer; never throws, never blocks the caller for long. */
export async function logEvent(e: { type: EventType; level?: "info" | "warn" | "error"; message: string; userId?: string | null; ip?: string | null; meta?: Record<string, unknown> }) {
  try {
    await db.eventLog.create({
      data: {
        type: e.type, level: e.level ?? "info", message: e.message.slice(0, 400), userId: e.userId ?? null,
        ip: e.ip ? e.ip.slice(0, 64) : null, meta: e.meta ? JSON.stringify(e.meta).slice(0, 4000) : null,
      },
    })
  } catch {
    /* logging must never break a request */
  }
}
