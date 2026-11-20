/**
 * Admin-granted lesson-price breaks: a one-off PersonalDiscount for a single student or teacher
 * (100% = a fully free/comped account — used e.g. to let a new teacher's lessons be free for a while
 * to attract students), and a Campaign, a scheduled platform-wide discount (New Year's, etc.) that
 * activates and expires purely by date, the same way scheduled articles/products already do.
 *
 * Neither ever gets snapshotted onto a Booking: the already-stored, server-computed price paid IS the
 * record, exactly like the existing Premium/Sınırsız member lesson discount in lib/subscriptions.ts.
 */

export const MIN_DISCOUNT_PCT = 1
export const MAX_DISCOUNT_PCT = 100

export interface PersonalDiscountInput {
  discountPct: unknown
  reason?: unknown
  endsAt?: unknown
}
export type PersonalDiscountValidation =
  | { ok: true; discountPct: number; reason: string | null; endsAt: Date | null }
  | { ok: false; error: string }

export function validatePersonalDiscountInput(i: PersonalDiscountInput): PersonalDiscountValidation {
  const pct = Number(i.discountPct)
  if (!Number.isFinite(pct) || pct < MIN_DISCOUNT_PCT || pct > MAX_DISCOUNT_PCT) {
    return { ok: false, error: `İndirim oranı %${MIN_DISCOUNT_PCT} ile %${MAX_DISCOUNT_PCT} arasında olmalı.` }
  }
  const reason = typeof i.reason === "string" ? i.reason.trim().slice(0, 300) : ""
  let endsAt: Date | null = null
  if (i.endsAt) {
    const d = new Date(i.endsAt as string)
    if (Number.isNaN(d.getTime())) return { ok: false, error: "Geçersiz bitiş tarihi." }
    if (d.getTime() <= Date.now()) return { ok: false, error: "Bitiş tarihi gelecekte olmalı." }
    endsAt = d
  }
  return { ok: true, discountPct: Math.round(pct * 10) / 10, reason: reason || null, endsAt }
}

export interface CampaignInput {
  name: unknown
  discountPct: unknown
  scope: unknown
  bannerMessage?: unknown
  startsAt: unknown
  endsAt: unknown
}
export type CampaignValidation =
  | { ok: true; name: string; discountPct: number; scope: "STUDENTS" | "TEACHERS" | "ALL"; bannerMessage: string | null; startsAt: Date; endsAt: Date }
  | { ok: false; error: string }

export function validateCampaignInput(i: CampaignInput): CampaignValidation {
  const name = typeof i.name === "string" ? i.name.trim().slice(0, 120) : ""
  if (name.length < 3) return { ok: false, error: "Kampanya adı en az 3 karakter olmalı." }
  const pct = Number(i.discountPct)
  if (!Number.isFinite(pct) || pct < MIN_DISCOUNT_PCT || pct > MAX_DISCOUNT_PCT) {
    return { ok: false, error: `İndirim oranı %${MIN_DISCOUNT_PCT} ile %${MAX_DISCOUNT_PCT} arasında olmalı.` }
  }
  const scope = i.scope === "STUDENTS" || i.scope === "TEACHERS" || i.scope === "ALL" ? i.scope : null
  if (!scope) return { ok: false, error: "Geçerli bir kapsam seçin (öğrenciler, öğretmenler veya herkes)." }
  const startsAt = new Date(i.startsAt as string)
  const endsAt = new Date(i.endsAt as string)
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return { ok: false, error: "Geçersiz tarih." }
  if (endsAt.getTime() <= startsAt.getTime()) return { ok: false, error: "Bitiş tarihi başlangıçtan sonra olmalı." }
  const bannerMessage = typeof i.bannerMessage === "string" ? i.bannerMessage.trim().slice(0, 300) : ""
  return { ok: true, name, discountPct: Math.round(pct * 10) / 10, scope, bannerMessage: bannerMessage || null, startsAt, endsAt }
}

export interface PersonalDiscountRow { discountPct: number; endsAt: Date | string | null }

/** 0 once a personal discount's endsAt has passed; its own discountPct while still running or open-ended. */
export function personalDiscountPct(d: PersonalDiscountRow | null | undefined, now: Date = new Date()): number {
  if (!d) return 0
  if (d.endsAt && new Date(d.endsAt).getTime() <= now.getTime()) return 0
  return d.discountPct
}

export interface CampaignRow { discountPct: number; scope: "STUDENTS" | "TEACHERS" | "ALL"; startsAt: Date | string; endsAt: Date | string }

export function isCampaignActive(c: CampaignRow, now: Date = new Date()): boolean {
  return new Date(c.startsAt).getTime() <= now.getTime() && now.getTime() <= new Date(c.endsAt).getTime()
}

/** The best currently-active campaign discount that covers this role (a STUDENTS/TEACHERS campaign, or an ALL one). */
export function campaignDiscountPct(campaigns: CampaignRow[], role: "STUDENT" | "TEACHER", now: Date = new Date()): number {
  const roleScope = role === "STUDENT" ? "STUDENTS" : "TEACHERS"
  let best = 0
  for (const c of campaigns) {
    if (c.scope !== "ALL" && c.scope !== roleScope) continue
    if (!isCampaignActive(c, now)) continue
    if (c.discountPct > best) best = c.discountPct
  }
  return best
}

/** price × (1 − pct/100), rounded to cents; a non-positive price or pct passes through unchanged. */
export function applyDiscountPct(amount: number, pct: number): number {
  if (amount <= 0 || pct <= 0) return amount
  const clamped = Math.min(MAX_DISCOUNT_PCT, Math.max(0, pct))
  return Math.round(amount * (1 - clamped / 100) * 100) / 100
}
