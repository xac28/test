import { describe, expect, it } from "vitest"
import { envProblems } from "../../src/lib/env-check"

const good = {
  AUTH_SECRET: "a-long-random-secret-value-1234567890", CRON_SECRET: "another-long-random-secret-0987654321",
  NEXT_PUBLIC_SITE_URL: "https://aya.example.com", NEXTAUTH_URL: "https://aya.example.com",
  SMTP_USER: "mail@aya.example.com", SMTP_PASS: "app-password", STRIPE_SECRET_KEY: "sk_live_xxx",
  LIVEKIT_API_KEY: "APIabc123", LIVEKIT_API_SECRET: "s3cr3t-value-xyz", LIVEKIT_URL: "wss://live.aya.example.com",
}

describe("production configuration check", () => {
  it("accepts a complete configuration", () => {
    expect(envProblems(good)).toEqual([])
  })
  it("flags weak or placeholder values", () => {
    const p = envProblems({ ...good, AUTH_SECRET: "change-me", CRON_SECRET: "", NEXT_PUBLIC_SITE_URL: "http://localhost:3000", SMTP_USER: "", STRIPE_SECRET_KEY: "sk_test_dummy", LIVEKIT_API_KEY: "devkey", LIVEKIT_API_SECRET: "secret", LIVEKIT_URL: "ws://live.aya.example.com" })
    const text = p.join("\n")
    for (const key of ["AUTH_SECRET", "CRON_SECRET", "NEXT_PUBLIC_SITE_URL", "SMTP_USER", "STRIPE_SECRET_KEY", "development key pair", "wss://"]) expect(text).toContain(key)
  })
  it("warns about a non-https NEXTAUTH_URL", () => {
    expect(envProblems({ ...good, NEXTAUTH_URL: "http://aya.example.com" }).join()).toContain("NEXTAUTH_URL")
  })
})
