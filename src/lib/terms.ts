import { NextResponse } from "next/server"

/** Bump this when the terms change materially — everyone is asked to accept again. */
export const CURRENT_TERMS_VERSION = "2026-10"

/** Lesson recordings are deleted this many days after the lesson starts. */
export const RECORDING_RETENTION_DAYS = 30

export function hasAcceptedCurrentTerms(user: {
  termsAcceptedAt?: Date | string | null
  termsVersion?: string | null
}): boolean {
  return !!user.termsAcceptedAt && user.termsVersion === CURRENT_TERMS_VERSION
}

/** Fields to persist when a user accepts the current terms. */
export function termsAcceptanceData(now: Date = new Date()) {
  return { termsAcceptedAt: now, termsVersion: CURRENT_TERMS_VERSION }
}

/**
 * Gate for API routes: returns a 403 response when the user has not accepted the
 * current terms, otherwise null. Clients detect `code: "TERMS_REQUIRED"` and
 * send the user to the acceptance screen.
 */
export function termsGate(user: { termsAccepted?: boolean } | null): NextResponse | null {
  if (user && user.termsAccepted === false) {
    return NextResponse.json(
      { error: "Devam etmek için sözleşmeyi kabul etmelisiniz.", code: "TERMS_REQUIRED" },
      { status: 403 }
    )
  }
  return null
}

/** Only same-site relative paths are allowed as post-acceptance redirect targets. */
export function safeNextPath(next: string | null | undefined, fallback = "/panel"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback
  if (next.startsWith("/accept-terms") || next.startsWith("/login")) return fallback
  return next
}
