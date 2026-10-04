/** Teacher payout requests: balance maths and validation. Money is USD, rounded to cents. */

export const MIN_PAYOUT_USD = 10

export type PayoutMethod = "IBAN" | "STRIPE"

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** What the teacher earned from completed lessons after the platform commission. */
export function computeEarned(
  bookings: { price: number; status: string }[],
  commissionRate: number
): number {
  return round2(
    bookings
      .filter((b) => b.status === "COMPLETED")
      .reduce((sum, b) => sum + b.price * (1 - commissionRate), 0)
  )
}

/** Requests that already claim part of the balance (rejected ones give it back). */
export function computeClaimed(requests: { amount: number; status: string }[]): number {
  return round2(
    requests
      .filter((r) => r.status === "PENDING" || r.status === "APPROVED" || r.status === "PAID")
      .reduce((sum, r) => sum + r.amount, 0)
  )
}

export function computeAvailable(earned: number, claimed: number): number {
  return Math.max(0, round2(earned - claimed))
}

/** ISO 13616 mod-97 check; accepts spaces and lower case. */
export function isValidIban(raw: string): boolean {
  const iban = raw.replace(/\s+/g, "").toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false
  if (iban.startsWith("TR") && iban.length !== 26) return false
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let remainder = 0
  for (const ch of rearranged) {
    const digits = ch >= "A" ? String(ch.charCodeAt(0) - 55) : ch
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97
  }
  return remainder === 1
}

export function normalizeIban(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase()
}

export interface PayoutInput {
  amount: unknown
  method?: unknown
  iban?: unknown
  accountName?: unknown
}

export type PayoutValidation =
  | { ok: true; amount: number; method: PayoutMethod; iban: string | null; accountName: string | null }
  | { ok: false; error: string }

export function validatePayoutRequest(
  input: PayoutInput,
  available: number,
  opts: { hasStripeConnect?: boolean } = {}
): PayoutValidation {
  const amount = typeof input.amount === "number" ? input.amount : Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Geçerli bir tutar girin." }
  const rounded = round2(amount)
  if (rounded < MIN_PAYOUT_USD) {
    return { ok: false, error: `En düşük ödeme talebi ${MIN_PAYOUT_USD} USD'dir.` }
  }
  if (rounded > available + 0.0001) {
    return { ok: false, error: "Talep edilen tutar çekilebilir bakiyenizi aşıyor." }
  }

  const method: PayoutMethod = input.method === "STRIPE" ? "STRIPE" : "IBAN"
  if (method === "STRIPE") {
    if (!opts.hasStripeConnect) {
      return { ok: false, error: "Stripe ile ödeme için önce Stripe hesabınızı bağlayın." }
    }
    return { ok: true, amount: rounded, method, iban: null, accountName: null }
  }

  const iban = typeof input.iban === "string" ? input.iban : ""
  const accountName = typeof input.accountName === "string" ? input.accountName.trim() : ""
  if (!isValidIban(iban)) return { ok: false, error: "Geçerli bir IBAN girin." }
  if (accountName.length < 3) return { ok: false, error: "Hesap sahibinin adını girin." }
  return { ok: true, amount: rounded, method, iban: normalizeIban(iban), accountName }
}

export type PayoutAction = "approve" | "reject" | "mark_paid"
type Status = "PENDING" | "APPROVED" | "REJECTED" | "PAID"

const TRANSITIONS: Record<PayoutAction, { from: Status[]; to: Status }> = {
  approve: { from: ["PENDING"], to: "APPROVED" },
  reject: { from: ["PENDING", "APPROVED"], to: "REJECTED" },
  mark_paid: { from: ["APPROVED"], to: "PAID" },
}

export function nextPayoutStatus(current: string, action: string): Status | null {
  const t = TRANSITIONS[action as PayoutAction]
  if (!t) return null
  return t.from.includes(current as Status) ? t.to : null
}

export const PAYOUT_STATUS_LABEL_TR: Record<string, string> = {
  PENDING: "Beklemede",
  APPROVED: "Onaylandı",
  REJECTED: "Reddedildi",
  PAID: "Ödendi",
}
