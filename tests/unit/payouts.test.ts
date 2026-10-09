import { describe, it, expect } from "vitest"
import {
  computeAvailable, computeClaimed, computeEarned, isValidIban, nextPayoutStatus, validatePayoutRequest,
} from "@/lib/payouts"

describe("balance", () => {
  it("earned counts completed lessons net of commission", () => {
    const bookings = [
      { price: 100, status: "COMPLETED" },
      { price: 50, status: "COMPLETED" },
      { price: 999, status: "CONFIRMED" },
      { price: 999, status: "CANCELLED" },
    ]
    expect(computeEarned(bookings, 0.15)).toBe(127.5)
  })
  it("rejected requests give the balance back", () => {
    const reqs = [
      { amount: 40, status: "PENDING" },
      { amount: 30, status: "APPROVED" },
      { amount: 20, status: "PAID" },
      { amount: 500, status: "REJECTED" },
    ]
    expect(computeClaimed(reqs)).toBe(90)
    expect(computeAvailable(127.5, 90)).toBe(37.5)
    expect(computeAvailable(10, 90)).toBe(0)
  })
  it("avoids float drift", () => {
    expect(computeEarned([{ price: 33.33, status: "COMPLETED" }], 0.15)).toBe(28.33)
  })
})

describe("iban", () => {
  it("accepts a valid TR IBAN with spaces/lowercase", () => {
    expect(isValidIban("TR33 0006 1005 1978 6457 8413 26")).toBe(true)
    expect(isValidIban("tr330006100519786457841326")).toBe(true)
  })
  it("rejects bad checksum, bad length and garbage", () => {
    expect(isValidIban("TR33 0006 1005 1978 6457 8413 27")).toBe(false)
    expect(isValidIban("TR33 0006 1005 1978 6457 8413")).toBe(false)
    expect(isValidIban("hello")).toBe(false)
    expect(isValidIban("")).toBe(false)
  })
})

describe("validatePayoutRequest", () => {
  const iban = "TR33 0006 1005 1978 6457 8413 26"
  it("accepts a good IBAN request and normalises it", () => {
    const v = validatePayoutRequest({ amount: "50.456", iban, accountName: " Ayşe Yılmaz " }, 100)
    expect(v).toEqual({ ok: true, amount: 50.46, method: "IBAN", iban: "TR330006100519786457841326", accountName: "Ayşe Yılmaz" })
  })
  it("rejects amounts above balance, below minimum, and non-numbers", () => {
    expect(validatePayoutRequest({ amount: 150, iban, accountName: "Ayşe Yılmaz" }, 100).ok).toBe(false)
    expect(validatePayoutRequest({ amount: 5, iban, accountName: "Ayşe Yılmaz" }, 100).ok).toBe(false)
    expect(validatePayoutRequest({ amount: "abc", iban, accountName: "Ayşe Yılmaz" }, 100).ok).toBe(false)
    expect(validatePayoutRequest({ amount: -20, iban, accountName: "Ayşe Yılmaz" }, 100).ok).toBe(false)
  })
  it("requires IBAN and holder name for IBAN payouts", () => {
    expect(validatePayoutRequest({ amount: 20, iban: "x", accountName: "Ayşe Yılmaz" }, 100).ok).toBe(false)
    expect(validatePayoutRequest({ amount: 20, iban, accountName: "" }, 100).ok).toBe(false)
  })
  it("Stripe payouts need a connected account", () => {
    expect(validatePayoutRequest({ amount: 20, method: "STRIPE" }, 100).ok).toBe(false)
    expect(validatePayoutRequest({ amount: 20, method: "STRIPE" }, 100, { hasStripeConnect: true }).ok).toBe(true)
  })
})

describe("status transitions", () => {
  it("allows only the documented moves", () => {
    expect(nextPayoutStatus("PENDING", "approve")).toBe("APPROVED")
    expect(nextPayoutStatus("PENDING", "reject")).toBe("REJECTED")
    expect(nextPayoutStatus("APPROVED", "mark_paid")).toBe("PAID")
    expect(nextPayoutStatus("APPROVED", "reject")).toBe("REJECTED")
    expect(nextPayoutStatus("PENDING", "mark_paid")).toBeNull()
    expect(nextPayoutStatus("PAID", "reject")).toBeNull()
    expect(nextPayoutStatus("REJECTED", "approve")).toBeNull()
    expect(nextPayoutStatus("PENDING", "explode")).toBeNull()
  })
})
