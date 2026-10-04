import { describe, it, expect } from "vitest"
import {
  CURRENT_TERMS_VERSION,
  hasAcceptedCurrentTerms,
  termsAcceptanceData,
  termsGate,
  safeNextPath,
  RECORDING_RETENTION_DAYS,
} from "@/lib/terms"

describe("terms", () => {
  it("requires both a timestamp and the current version", () => {
    expect(hasAcceptedCurrentTerms({ termsAcceptedAt: null, termsVersion: null })).toBe(false)
    expect(hasAcceptedCurrentTerms({ termsAcceptedAt: new Date(), termsVersion: "old" })).toBe(false)
    expect(hasAcceptedCurrentTerms({ termsAcceptedAt: new Date(), termsVersion: CURRENT_TERMS_VERSION })).toBe(true)
  })

  it("termsAcceptanceData stamps the current version", () => {
    const now = new Date("2026-10-04T10:00:00Z")
    expect(termsAcceptanceData(now)).toEqual({ termsAcceptedAt: now, termsVersion: CURRENT_TERMS_VERSION })
  })

  it("termsGate blocks only users who have not accepted", async () => {
    expect(termsGate(null)).toBeNull()
    expect(termsGate({ termsAccepted: true })).toBeNull()
    const res = termsGate({ termsAccepted: false })!
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe("TERMS_REQUIRED")
  })

  it("safeNextPath only allows same-site relative paths", () => {
    expect(safeNextPath("/dashboard/profile")).toBe("/dashboard/profile")
    expect(safeNextPath("https://evil.example")).toBe("/dashboard")
    expect(safeNextPath("//evil.example")).toBe("/dashboard")
    expect(safeNextPath("/\\evil")).toBe("/dashboard")
    expect(safeNextPath("/accept-terms?x=1")).toBe("/dashboard")
    expect(safeNextPath(null, "/teach")).toBe("/teach")
  })

  it("keeps recordings for 30 days", () => {
    expect(RECORDING_RETENTION_DAYS).toBe(30)
  })
})
