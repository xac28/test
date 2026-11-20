import { describe, it, expect } from "vitest"
import {
  computeBrandAvailableKurus, computeBrandClaimedKurus, computeBrandEarnedKurus,
  validateBrandInput, validateBrandPayoutInput, MIN_BRAND_PAYOUT_KURUS,
} from "@/lib/brands"

describe("validateBrandInput", () => {
  it("accepts a minimal brand and defaults the commission rate to 20%", () => {
    const v = validateBrandInput({ name: "Sage Mat Co." })
    expect(v.ok).toBe(true)
    if (v.ok) expect(v.data).toMatchObject({ name: "Sage Mat Co.", commissionRate: 0.2, active: true, iban: null })
  })

  it("rejects a too-short name, a bad e-mail, an out-of-range commission and a bad IBAN", () => {
    expect(validateBrandInput({ name: "A" }).ok).toBe(false)
    expect(validateBrandInput({ name: "Sage Mat", contactEmail: "not-an-email" }).ok).toBe(false)
    expect(validateBrandInput({ name: "Sage Mat", commissionRate: 1.2 }).ok).toBe(false)
    expect(validateBrandInput({ name: "Sage Mat", commissionRate: -0.1 }).ok).toBe(false)
    expect(validateBrandInput({ name: "Sage Mat", iban: "not-an-iban" }).ok).toBe(false)
  })

  it("normalises a valid IBAN and rounds the commission rate", () => {
    const v = validateBrandInput({ name: "Sage Mat", commissionRate: 0.12345, iban: "tr33 0006 1005 1978 6457 8413 26" })
    expect(v.ok).toBe(true)
    if (v.ok) {
      expect(v.data.iban).toBe("TR330006100519786457841326")
      expect(v.data.commissionRate).toBe(0.123)
    }
  })

  it("active defaults to true and only an explicit false turns it off", () => {
    expect(validateBrandInput({ name: "Sage Mat" }).ok && true).toBe(true)
    const off = validateBrandInput({ name: "Sage Mat", active: false })
    expect(off.ok && off.data.active).toBe(false)
  })
})

const item = (unitKurus: number, quantity: number, status: string, rate: number | null) => ({ unitKurus, quantity, brandCommissionRate: rate, order: { status } })

describe("computeBrandEarnedKurus", () => {
  it("counts paid/shipped/delivered orders, using each sale's own snapshotted commission rate", () => {
    const earned = computeBrandEarnedKurus([
      item(10_000, 2, "PAID", 0.2), // 20000 * 0.8 = 16000
      item(5_000, 1, "SHIPPED", 0.5), // 5000 * 0.5 = 2500
      item(3_000, 1, "DELIVERED", 0), // 3000 * 1 = 3000
    ])
    expect(earned).toBe(16_000 + 2_500 + 3_000)
  })

  it("ignores orders that were never paid or were cancelled/refunded, even after being paid", () => {
    const earned = computeBrandEarnedKurus([
      item(10_000, 1, "PENDING_PAYMENT", 0.2),
      item(10_000, 1, "CANCELLED", 0.2),
    ])
    expect(earned).toBe(0)
  })

  it("treats a missing snapshot rate as 0% commission (the brand gets it all)", () => {
    expect(computeBrandEarnedKurus([item(10_000, 1, "PAID", null)])).toBe(10_000)
  })
})

describe("claimed / available", () => {
  it("claimed is the sum of recorded payouts; available never goes negative", () => {
    expect(computeBrandClaimedKurus([{ amountKurus: 5_000 }, { amountKurus: 3_000 }])).toBe(8_000)
    expect(computeBrandAvailableKurus(10_000, 8_000)).toBe(2_000)
    expect(computeBrandAvailableKurus(5_000, 8_000)).toBe(0) // e.g. a sale was refunded after a payout was already recorded
  })
})

describe("validateBrandPayoutInput", () => {
  it("accepts an amount within the available balance and at least the minimum", () => {
    const v = validateBrandPayoutInput({ amountKurus: MIN_BRAND_PAYOUT_KURUS, note: "Kasım ödemesi" }, MIN_BRAND_PAYOUT_KURUS + 1)
    expect(v.ok).toBe(true)
    if (v.ok) expect(v).toMatchObject({ amountKurus: MIN_BRAND_PAYOUT_KURUS, note: "Kasım ödemesi" })
  })

  it("rejects a non-positive amount, below the minimum, and more than the available balance", () => {
    expect(validateBrandPayoutInput({ amountKurus: 0 }, 1_000_000).ok).toBe(false)
    expect(validateBrandPayoutInput({ amountKurus: -500 }, 1_000_000).ok).toBe(false)
    expect(validateBrandPayoutInput({ amountKurus: MIN_BRAND_PAYOUT_KURUS - 1 }, 1_000_000).ok).toBe(false)
    expect(validateBrandPayoutInput({ amountKurus: 1_000_001 }, 1_000_000).ok).toBe(false)
  })

  it("an empty note becomes null, a long one is capped at 300 characters", () => {
    const v = validateBrandPayoutInput({ amountKurus: MIN_BRAND_PAYOUT_KURUS, note: "  " }, MIN_BRAND_PAYOUT_KURUS)
    expect(v.ok && v.note).toBeNull()
    const long = validateBrandPayoutInput({ amountKurus: MIN_BRAND_PAYOUT_KURUS, note: "x".repeat(400) }, MIN_BRAND_PAYOUT_KURUS)
    expect(long.ok && long.note?.length).toBe(300)
  })
})
