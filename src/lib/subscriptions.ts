/**
 * Membership plans (pure rules, no database): prices, what each plan unlocks, and which plan a user is on right now.
 *  - FREE (Keşfet): pay per lesson, public broadcasts.
 *  - PREMIUM: PREMIUM_MONTHLY_PASSES entries per month into any teacher's students-only ($) broadcast + lesson discount.
 *  - UNLIMITED (Sınırsız): every students-only broadcast, any number of times + lesson discount.
 * Prices are TL and come from the environment (SUB_PRICE_PREMIUM_MONTHLY=499 …) so they can change without a code change.
 */

export type PaidPlan = "PREMIUM" | "UNLIMITED"
export type PlanId = "FREE" | PaidPlan
export type BillingInterval = "MONTHLY" | "YEARLY"

export const PAID_PLANS: PaidPlan[] = ["PREMIUM", "UNLIMITED"]
export const INTERVALS: BillingInterval[] = ["MONTHLY", "YEARLY"]
export const PREMIUM_MONTHLY_PASSES = 8
export const LESSON_DISCOUNT = 0.2
/** a renewal is charged on the last day; iyzico's notice can arrive a little later, so access runs on for this long */
export const RENEWAL_GRACE_MS = 36 * 60 * 60 * 1000

/** kuruş; yearly = 12 months with 20% off */
const DEFAULT_PRICE_KURUS: Record<PaidPlan, Record<BillingInterval, number>> = {
  PREMIUM: { MONTHLY: 49_900, YEARLY: 479_000 },
  UNLIMITED: { MONTHLY: 99_900, YEARLY: 959_000 },
}

export const isPaidPlan = (v: unknown): v is PaidPlan => v === "PREMIUM" || v === "UNLIMITED"
export const isInterval = (v: unknown): v is BillingInterval => v === "MONTHLY" || v === "YEARLY"

/** Price in kuruş; SUB_PRICE_<PLAN>_<INTERVAL> (in TL, e.g. "499" or "479,90") overrides the default. */
export function planPriceKurus(plan: PaidPlan, interval: BillingInterval, env: Record<string, string | undefined> = process.env): number {
  const raw = env[`SUB_PRICE_${plan}_${interval}`]
  if (raw) {
    const tl = Number(String(raw).replace(/\s|₺|TL/gi, "").replace(",", "."))
    if (Number.isFinite(tl) && tl >= 1 && tl <= 1_000_000) return Math.round(tl * 100)
  }
  return DEFAULT_PRICE_KURUS[plan][interval]
}

/** "₺499" / "₺4.790" / "₺479,90" */
export function formatTL(kurus: number): string {
  const tl = kurus / 100
  return `₺${tl.toLocaleString("tr-TR", { minimumFractionDigits: Number.isInteger(tl) ? 0 : 2, maximumFractionDigits: 2 })}`
}

export const PLAN_LABEL: Record<PlanId, string> = { FREE: "Keşfet", PREMIUM: "Premium", UNLIMITED: "Sınırsız" }
export const INTERVAL_LABEL: Record<BillingInterval, string> = { MONTHLY: "Aylık", YEARLY: "Yıllık" }

/** What each plan really does — the pricing page lists exactly these, and every line is enforced somewhere. */
export const PLAN_FEATURES: Record<PlanId, string[]> = {
  FREE: [
    "Birebir derslerde ders başına ödeme",
    "Herkese açık canlı yayınlar ve sohbet",
    "AYA yapay zekâ yoga rehberi",
    "Topluluk, yazılar ve podcast",
  ],
  PREMIUM: [
    `Tüm eğitmenlerin öğrencilere özel ($) canlı yayınlarına ayda ${PREMIUM_MONTHLY_PASSES} katılım`,
    `Birebir derslerde %${LESSON_DISCOUNT * 100} indirim`,
    "Premium rozeti",
    "Keşfet planındaki her şey",
  ],
  UNLIMITED: [
    "Tüm eğitmenlerin öğrencilere özel ($) canlı yayınlarına sınırsız katılım",
    `Birebir derslerde %${LESSON_DISCOUNT * 100} indirim`,
    "Sınırsız rozeti",
    "Keşfet planındaki her şey",
  ],
}

/** The plan a user is on right now: a paid plan only while its paid period (plus a short renewal grace) has not ended. */
export function effectivePlan(u: { subscriptionPlan?: string | null; subscriptionEnds?: Date | string | null } | null | undefined, now: Date = new Date()): PlanId {
  if (!u || !isPaidPlan(u.subscriptionPlan) || !u.subscriptionEnds) return "FREE"
  const ends = new Date(u.subscriptionEnds).getTime()
  return ends + RENEWAL_GRACE_MS > now.getTime() ? u.subscriptionPlan : "FREE"
}

/** Lesson price after the member discount, rounded to cents. */
export function memberLessonPrice(price: number, plan: PlanId): number {
  if (plan === "FREE" || price <= 0) return price
  return Math.round(price * (1 - LESSON_DISCOUNT) * 100) / 100
}

/** Calendar month in Turkey ("2026-11"): Premium passes reset on the 1st. */
export function monthKey(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit" }).formatToParts(d)
  const y = parts.find((p) => p.type === "year")?.value
  const m = parts.find((p) => p.type === "month")?.value
  return `${y}-${m}`
}

export function addInterval(from: Date, interval: BillingInterval): Date {
  const d = new Date(from)
  if (interval === "YEARLY") d.setUTCFullYear(d.getUTCFullYear() + 1)
  else d.setUTCMonth(d.getUTCMonth() + 1)
  return d
}

/** iyzico wants "+905321234567"; accepts 0532…, 532…, 90532…, +90 532 … */
export function normalizeTrGsm(raw: string): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "")
  let national = digits
  if (national.startsWith("90") && national.length === 12) national = national.slice(2)
  if (national.startsWith("0") && national.length === 11) national = national.slice(1)
  return /^5\d{9}$/.test(national) ? `+90${national}` : null
}
