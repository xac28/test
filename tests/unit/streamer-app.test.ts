import { describe, it, expect } from "vitest"
import { createRequire } from "module"

const lib = createRequire(import.meta.url)("../../streamer/lib.js")

describe("desktop app: pairing code", () => {
  it("accepts the code however it was typed", () => {
    for (const raw of ["K7QM-4TXD", "k7qm4txd", " k7qm 4txd ", "K7QM_4TXD"]) expect(lib.normalizeCode(raw), raw).toBe("K7QM-4TXD")
  })
  it("rejects what cannot be a code (wrong length, look-alike characters, non-strings)", () => {
    for (const raw of ["", "K7QM", "K7QM-4TXD-1", "K7QM-4TX0", "K7QM-4TXI", "K7QM-4TXL", "K7QM-4TXO", "K7QM-4TX!"]) expect(lib.normalizeCode(raw), raw).toBeNull()
    for (const raw of [null, undefined, 12345678, {}]) expect(lib.normalizeCode(raw as any)).toBeNull()
  })
})

describe("desktop app: server address", () => {
  it("only https, plus plain http for this computer", () => {
    expect(lib.normalizeServerUrl("https://aya.example.com/")).toBe("https://aya.example.com")
    expect(lib.normalizeServerUrl("https://aya.example.com:8443/x?y=1")).toBe("https://aya.example.com:8443")
    expect(lib.normalizeServerUrl("http://localhost:3000")).toBe("http://localhost:3000")
    expect(lib.normalizeServerUrl("http://127.0.0.1:3000")).toBe("http://127.0.0.1:3000")
  })
  it("refuses plain http elsewhere, other schemes, credentials in the URL and junk", () => {
    for (const raw of ["http://aya.example.com", "ftp://aya.example.com", "file:///etc/passwd", "javascript:alert(1)", "https://user:pw@aya.example.com", "not a url", "", "http://localhost.evil.com"]) {
      expect(lib.normalizeServerUrl(raw), raw).toBeNull()
    }
    expect(lib.normalizeServerUrl(undefined as any)).toBeNull()
  })
})

describe("desktop app: navigation limits", () => {
  const origin = "https://aya.example.com"
  it("the studio window stays on the server's own origin", () => {
    expect(lib.isSameOrigin("https://aya.example.com/live/studio", origin)).toBe(true)
    for (const u of ["https://evil.com/", "https://aya.example.com.evil.com/", "http://aya.example.com/", "https://aya.example.com:444/", "about:blank", "garbage"]) {
      expect(lib.isSameOrigin(u, origin), u).toBe(false)
    }
  })
  it("external links open only over https", () => {
    expect(lib.isSafeExternal("https://example.com/help")).toBe(true)
    for (const u of ["http://example.com", "file:///C:/Windows/System32/calc.exe", "javascript:alert(1)", "ms-msdt:/id", "garbage"]) expect(lib.isSafeExternal(u), u).toBe(false)
  })
  it("permissions are limited to what streaming needs", () => {
    for (const p of ["media", "display-capture"]) expect(lib.ALLOWED_PERMISSIONS.has(p)).toBe(true)
    for (const p of ["geolocation", "notifications", "openExternal", "midi", "usb"]) expect(lib.ALLOWED_PERMISSIONS.has(p)).toBe(false)
  })
})

describe("desktop app: version check", () => {
  it("compares numerically, not as text", () => {
    expect(lib.olderThan("1.2.0", "1.10.0")).toBe(true)
    expect(lib.olderThan("1.10.0", "1.2.0")).toBe(false)
    expect(lib.olderThan("1.0.0", "1.0.0")).toBe(false)
    expect(lib.olderThan("0.9.9", "1.0.0")).toBe(true)
    expect(lib.olderThan("1.0", "1.0.1")).toBe(true)
  })
})
