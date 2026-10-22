import { describe, it, expect } from "vitest"
import { normalizeMime, validateMagicBytes } from "@/lib/upload-validation"

const buf = (...b: number[]) => new Uint8Array(b).buffer
const ascii = (s: string) => Array.from(s).map((c) => c.charCodeAt(0))
const isoBmff = (box: string) => buf(0, 0, 0, 0x20, ...ascii(box), ...ascii("isom"), 0, 0, 0, 0)

describe("normalizeMime", () => {
  it("maps phone-library aliases to canonical types", () => {
    expect(normalizeMime("image/jpg")).toBe("image/jpeg")
    expect(normalizeMime("IMAGE/PJPEG")).toBe("image/jpeg")
    expect(normalizeMime("video/x-m4v")).toBe("video/mp4")
    expect(normalizeMime("video/quicktime")).toBe("video/quicktime")
    expect(normalizeMime("")).toBe("")
  })
})

describe("validateMagicBytes", () => {
  it("accepts real signatures", () => {
    expect(validateMagicBytes(buf(0xff, 0xd8, 0xff, 0xe0, 0), "image/jpeg")).toBe(true)
    expect(validateMagicBytes(buf(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), "image/png")).toBe(true)
    expect(validateMagicBytes(isoBmff("ftyp"), "video/mp4")).toBe(true)
    expect(validateMagicBytes(isoBmff("ftyp"), "video/quicktime")).toBe(true)
    expect(validateMagicBytes(isoBmff("moov"), "video/quicktime")).toBe(true)
    expect(validateMagicBytes(buf(0x1a, 0x45, 0xdf, 0xa3, 0), "video/webm")).toBe(true)
  })
  it("rejects mismatches and unknown types", () => {
    expect(validateMagicBytes(buf(0xff, 0xd8, 0xff, 0xe0, 0), "image/png")).toBe(false)
    expect(validateMagicBytes(isoBmff("zzzz"), "video/mp4")).toBe(false) // zero-prefixed junk is not an MP4
    expect(validateMagicBytes(buf(0, 0, 0), "video/mp4")).toBe(false) // too short
    expect(validateMagicBytes(buf(1, 2, 3, 4, 5), "text/html")).toBe(false)
  })
  it("webp needs the WEBP marker at offset 8", () => {
    const ok = buf(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP"))
    const bad = buf(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("AVI "))
    expect(validateMagicBytes(ok, "image/webp")).toBe(true)
    expect(validateMagicBytes(bad, "image/webp")).toBe(false)
  })
})
