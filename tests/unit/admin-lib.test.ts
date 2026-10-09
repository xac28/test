import { describe, it, expect } from "vitest"
import { csvCell, toCsv } from "../../src/lib/csv"
import { isBannableIp } from "../../src/lib/ban-engine"

describe("isBannableIp", () => {
  it("never bans loopback, private, link-local or unknown addresses", () => {
    for (const ip of ["127.0.0.1", "127.5.5.5", "::1", "10.0.0.1", "192.168.0.10", "172.16.0.1", "172.31.255.255", "169.254.1.1", "unknown", "", "fc00::1", "fd12::1", "fe80::1"]) {
      expect(isBannableIp(ip), ip).toBe(false)
    }
  })
  it("bans ordinary public addresses", () => {
    for (const ip of ["203.0.113.9", "8.8.8.8", "172.15.0.1", "172.32.0.1", "2001:db8::1"]) expect(isBannableIp(ip), ip).toBe(true)
  })
})

describe("csv", () => {
  it("quotes separators, quotes and newlines", () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"')
    expect(csvCell(null)).toBe("")
    expect(csvCell(new Date("2025-01-02T03:04:05Z"))).toBe("2025-01-02T03:04:05.000Z")
  })
  it("defuses spreadsheet formulas", () => {
    for (const evil of ["=1+1", "+SUM(A1)", "-2+3", "@cmd", "\tx"]) expect(csvCell(evil).startsWith("'")).toBe(true)
    expect(csvCell("-")).toBe("'-")
    expect(csvCell("normal -dash")).toBe("normal -dash")
  })
  it("writes a BOM and CRLF rows", () => {
    const out = toCsv(["a", "b"], [[1, "x"], [2, "y"]])
    expect(out.charCodeAt(0)).toBe(0xfeff)
    expect(out.slice(1)).toBe("a,b\r\n1,x\r\n2,y\r\n")
  })
})
