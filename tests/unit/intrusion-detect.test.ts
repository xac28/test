import { describe, it, expect } from "vitest"
import { pathShape } from "@/lib/intrusion-detect"

describe("pathShape (endpoint-enumeration folding)", () => {
  it("folds a uuid, a cuid and a numeric id to the same shape", () => {
    expect(pathShape("/api/teachers/550e8400-e29b-41d4-a716-446655440000")).toBe("/api/teachers/:id")
    expect(pathShape("/api/teachers/cklq2n8x40000qzrm5bjf8x3z")).toBe("/api/teachers/:id")
    expect(pathShape("/api/teachers/48291")).toBe("/api/teachers/:id")
  })

  it("folds other long opaque ids (e.g. Mongo-style hex) but keeps the query string out of it", () => {
    expect(pathShape("/api/recordings/5f8d0d55b54764421b7156c9")).toBe("/api/recordings/:id")
  })

  it("never folds this app's own real kebab-case route words", () => {
    for (const p of [
      "/api/cron/cleanup-recordings", "/api/cron/shop-maintenance", "/api/cron/process-bookings",
      "/api/private-uploads/certificates/x.pdf", "/api/teachers/stripe-connect", "/api/subscriptions",
      "/api/notifications", "/api/admin/live-monitor", "/api/admin/approve-trial",
    ]) {
      expect(pathShape(p)).toBe(p)
    }
  })

  it("keeps short slugs as they are (not every lowercase word is an id)", () => {
    expect(pathShape("/api/styles/vinyasa")).toBe("/api/styles/vinyasa")
    expect(pathShape("/api/poses/savasci-2")).toBe("/api/poses/savasci-2")
  })

  it("folds several different ids of the same route into one identical shape", () => {
    const shapes = new Set([
      "/api/teachers/cklq2n8x40000qzrm5bjf8x3z/reviews",
      "/api/teachers/cklq9999999999999999999z/reviews",
      "/api/teachers/550e8400-e29b-41d4-a716-446655440000/reviews",
    ].map(pathShape))
    expect(shapes.size).toBe(1)
    expect([...shapes][0]).toBe("/api/teachers/:id/reviews")
  })
})
