/**
 * Brand partners in the shop (mat, aromatherapy-oil brands, …): their own products sold alongside AYA's,
 * AYA taking commissionRate of each sale and the rest being the brand's. There is no brand login — the
 * admin manages their products, and once their share is actually wired (bank transfer), the admin records
 * it as a BrandPayout. "Earned" is always computed live from current order statuses and the per-sale
 * commissionRate snapshot on each OrderItem (see shop-server.ts), the same way lib/payouts.ts computes a
 * teacher's balance from completed bookings — so a later refund/cancellation is reflected automatically,
 * and a later change to the brand's own rate never rewrites a past sale.
 */
import { isValidIban, normalizeIban } from "@/lib/payouts"

export const MIN_BRAND_PAYOUT_KURUS = 50_000 // ₺500

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "")

export interface BrandInput {
  name?: unknown
  contactName?: unknown
  contactEmail?: unknown
  contactPhone?: unknown
  commissionRate?: unknown
  iban?: unknown
  accountName?: unknown
  active?: unknown
}

export type BrandValidation =
  | {
      ok: true
      data: {
        name: string
        contactName: string | null
        contactEmail: string | null
        contactPhone: string | null
        commissionRate: number
        iban: string | null
        accountName: string | null
        active: boolean
      }
    }
  | { ok: false; error: string }

export function validateBrandInput(i: BrandInput): BrandValidation {
  const name = str(i.name)
  if (name.length < 2 || name.length > 120) return { ok: false, error: "Marka adı 2–120 karakter olmalı." }
  const contactEmail = str(i.contactEmail).toLowerCase()
  if (contactEmail && (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contactEmail) || contactEmail.length > 190)) {
    return { ok: false, error: "Geçerli bir e-posta adresi girin." }
  }
  const rate = i.commissionRate === undefined || i.commissionRate === "" ? 0.2 : Number(i.commissionRate)
  if (!Number.isFinite(rate) || rate < 0 || rate > 0.9) return { ok: false, error: "Komisyon oranı %0–%90 arasında olmalı." }
  const ibanRaw = str(i.iban)
  if (ibanRaw && !isValidIban(ibanRaw)) return { ok: false, error: "Geçerli bir IBAN girin." }
  const contactPhone = str(i.contactPhone)
  if (contactPhone && !/^\+?[\d\s\-()]{7,20}$/.test(contactPhone)) return { ok: false, error: "Geçerli bir telefon numarası girin." }
  return {
    ok: true,
    data: {
      name,
      contactName: str(i.contactName).slice(0, 120) || null,
      contactEmail: contactEmail || null,
      contactPhone: contactPhone || null,
      commissionRate: Math.round(rate * 1000) / 1000,
      iban: ibanRaw ? normalizeIban(ibanRaw) : null,
      accountName: str(i.accountName).slice(0, 120) || null,
      active: i.active !== false,
    },
  }
}

/** The brand's share of sales that are actually paid for (and not since cancelled/refunded), using each sale's own snapshotted rate. */
export function computeBrandEarnedKurus(items: { unitKurus: number; quantity: number; brandCommissionRate: number | null; order: { status: string } }[]): number {
  return items
    .filter((i) => i.order.status === "PAID" || i.order.status === "SHIPPED" || i.order.status === "DELIVERED")
    .reduce((sum, i) => sum + Math.round(i.unitKurus * i.quantity * (1 - (i.brandCommissionRate ?? 0))), 0)
}

export function computeBrandClaimedKurus(payouts: { amountKurus: number }[]): number {
  return payouts.reduce((sum, p) => sum + p.amountKurus, 0)
}

export function computeBrandAvailableKurus(earnedKurus: number, claimedKurus: number): number {
  return Math.max(0, earnedKurus - claimedKurus)
}

export interface BrandPayoutInput {
  amountKurus?: unknown
  note?: unknown
}

export type BrandPayoutValidation = { ok: true; amountKurus: number; note: string | null } | { ok: false; error: string }

/** The admin recording a payout they already sent — validated against the brand's current available balance. */
export function validateBrandPayoutInput(input: BrandPayoutInput, availableKurus: number): BrandPayoutValidation {
  const amount = Math.round(Number(input.amountKurus))
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Geçerli bir tutar girin." }
  if (amount < MIN_BRAND_PAYOUT_KURUS) return { ok: false, error: `En düşük ödeme ₺${MIN_BRAND_PAYOUT_KURUS / 100}'dir.` }
  if (amount > availableKurus) return { ok: false, error: "Tutar markanın çekilebilir bakiyesini aşıyor." }
  return { ok: true, amountKurus: amount, note: typeof input.note === "string" ? input.note.trim().slice(0, 300) || null : null }
}
