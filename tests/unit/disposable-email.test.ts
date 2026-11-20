import { describe, it, expect, afterEach } from "vitest"
import { emailDomain, isDisposableEmailDomain, isValidEmailStrict, rejectFakeEmail } from "@/lib/disposable-email"

describe("isValidEmailStrict", () => {
  it("accepts ordinary real-looking addresses", () => {
    for (const e of ["ayse@example.com", "a.b+tag@sub.example.co.uk", "ogrenci@aya.test", "x@xn--nxasmq6b.com"]) {
      expect(isValidEmailStrict(e), e).toBe(true)
    }
  })

  it("rejects malformed addresses the old one-line regex let through", () => {
    for (const e of ["a@b", "nope", "a@@b.com", "a@b..com", ".a@b.com", "a.@b.com", "a@b.c", "a@.com", "", " a@b.com"]) {
      expect(isValidEmailStrict(e), e).toBe(false)
    }
  })

  it("rejects an unreasonably long address", () => {
    expect(isValidEmailStrict(`${"a".repeat(260)}@b.com`)).toBe(false)
  })
})

describe("isDisposableEmailDomain", () => {
  it("flags well-known throwaway providers", () => {
    for (const d of ["mailinator.com", "10minutemail.com", "guerrillamail.com", "yopmail.com", "tempmail.com", "MAILINATOR.COM"]) {
      expect(isDisposableEmailDomain(d), d).toBe(true)
    }
  })

  it("flags any subdomain of a wildcard provider", () => {
    expect(isDisposableEmailDomain("abc123.mailinator.com")).toBe(true)
    expect(isDisposableEmailDomain("deep.sub.mailinator.com")).toBe(true)
  })

  it("never flags ordinary real providers or this app's own test domain", () => {
    for (const d of ["gmail.com", "outlook.com", "icloud.com", "aya.test", "example.com", "notmailinator.com", "mailinator.company"]) {
      expect(isDisposableEmailDomain(d), d).toBe(false)
    }
  })

  it("reads operator-added domains from BLOCKED_EMAIL_DOMAINS_EXTRA at call time", () => {
    const prev = process.env.BLOCKED_EMAIL_DOMAINS_EXTRA
    process.env.BLOCKED_EMAIL_DOMAINS_EXTRA = "custom-spam.example, another.example"
    expect(isDisposableEmailDomain("custom-spam.example")).toBe(true)
    expect(isDisposableEmailDomain("another.example")).toBe(true)
    expect(isDisposableEmailDomain("gmail.com")).toBe(false)
    process.env.BLOCKED_EMAIL_DOMAINS_EXTRA = prev
  })
})

describe("rejectFakeEmail", () => {
  afterEach(() => {
    delete process.env.BLOCKED_EMAIL_DOMAINS_EXTRA
  })

  it("accepts a real-looking address", () => {
    expect(rejectFakeEmail("ayse@aya.test")).toBeNull()
  })

  it("rejects a disposable domain with a clear, specific message", () => {
    const msg = rejectFakeEmail("x@mailinator.com")
    expect(msg).not.toBeNull()
    expect(msg).toMatch(/geçici|tek kullanımlık/i)
  })

  it("rejects a malformed address with a format message, not the disposable one", () => {
    const msg = rejectFakeEmail("not-an-email")
    expect(msg).not.toBeNull()
    expect(msg).not.toMatch(/geçici|tek kullanımlık/i)
  })
})

describe("emailDomain", () => {
  it("extracts and lower-cases the domain", () => {
    expect(emailDomain("Someone@EXAMPLE.com")).toBe("example.com")
    expect(emailDomain("no-at-sign")).toBe("no-at-sign")
  })
})
