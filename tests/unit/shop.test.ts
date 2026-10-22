import { describe, it, expect } from "vitest"
import {
  FREE_SHIPPING_KURUS, SHIPPING_KURUS, calcTotals, canTransition, formatKurus, makeOrderCode, nextStatuses, parseImages, validateOrderInput, validateProductInput,
} from "@/lib/shop"
import { validatePodcastInput, formatDuration, itunesDuration, xmlEscape } from "@/lib/podcast"
import { renderMail } from "@/lib/newsletter"
import { validateMagicBytes } from "@/lib/upload-validation"

const product = (over: object = {}) => ({ name: "Kauçuk yoga matı", summary: "Kaymaz, 5 mm kalınlığında doğal kauçuk mat.", description: "Doğal kauçuktan üretilmiş, kaymaz yüzeyli yoga matı.", category: "matlar", priceTL: "749,90", stock: 10, images: ["/uploads/products/a.jpg"], ...over })

describe("product validation", () => {
  it("accepts a good product and converts the price to kuruş (comma or dot)", () => {
    const v = validateProductInput(product())
    expect(v.ok && v.data.priceKurus).toBe(74990)
    expect(validateProductInput(product({ priceTL: 749.9 })).ok && true).toBe(true)
    const ok = validateProductInput(product({ status: "PUBLISHED", featured: true, notify: true }))
    expect(ok.ok && ok.data.status).toBe("PUBLISHED")
    expect(ok.ok && ok.notify).toBe(true)
  })
  it("rejects bad input", () => {
    for (const bad of [{ name: "x" }, { summary: "kısa" }, { description: "kısa" }, { category: "araba" }, { priceTL: 0 }, { priceTL: "abc" }, { priceTL: 2_000_000 }, { stock: -1 }, { stock: 1.5 }, { images: ["javascript:alert(1)"] }, { images: Array(9).fill("/uploads/products/a.jpg") }]) {
      expect(validateProductInput(product(bad)).ok, JSON.stringify(bad)).toBe(false)
    }
  })
  it("parseImages survives garbage", () => {
    expect(parseImages('["/a.jpg","/b.jpg"]')).toEqual(["/a.jpg", "/b.jpg"])
    expect(parseImages("nope")).toEqual([])
    expect(parseImages(null)).toEqual([])
    expect(parseImages('{"a":1}')).toEqual([])
  })
})

describe("prices and totals", () => {
  it("formats kuruş as Turkish lira", () => {
    expect(formatKurus(74990)).toMatch(/749,90/)
    expect(formatKurus(50000)).toMatch(/500/)
    expect(formatKurus(50000)).not.toMatch(/,00/)
  })
  it("charges shipping below the free-shipping line only", () => {
    expect(calcTotals([{ unitKurus: 10000, quantity: 2 }])).toEqual({ subtotal: 20000, shipping: SHIPPING_KURUS, total: 20000 + SHIPPING_KURUS })
    expect(calcTotals([{ unitKurus: FREE_SHIPPING_KURUS, quantity: 1 }]).shipping).toBe(0)
    expect(calcTotals([{ unitKurus: FREE_SHIPPING_KURUS - 1, quantity: 1 }]).shipping).toBe(SHIPPING_KURUS)
    expect(calcTotals([]).total).toBe(0)
  })
})

const order = (over: object = {}) => ({ name: "Ayşe Yılmaz", email: "Ayse@Example.com", phone: "0532 123 45 67", address: "Bahçelievler mah. 12. sok. No 4 D 2", city: "Ankara / Çankaya", payMethod: "havale", items: [{ productId: "p1", quantity: 2 }], ...over })

describe("order validation", () => {
  it("normalises the contact data and merges duplicate lines", () => {
    const v = validateOrderInput(order({ items: [{ productId: "p1", quantity: 2 }, { productId: "p1", quantity: 3 }, { productId: "p2", quantity: 1 }] }))
    expect(v.ok).toBe(true)
    if (v.ok) {
      expect(v.data.email).toBe("ayse@example.com")
      expect(v.data.phone).toBe("05321234567")
      expect(v.data.items).toEqual([{ productId: "p1", quantity: 5 }, { productId: "p2", quantity: 1 }])
    }
  })
  it("rejects what a courier could not deliver", () => {
    for (const bad of [{ name: "A" }, { email: "x" }, { phone: "123" }, { address: "kısa" }, { city: "" }, { payMethod: "kredi" }, { items: [] }, { items: [{ productId: "p", quantity: 0 }] }, { items: [{ productId: "p", quantity: 99 }] }, { items: [{ quantity: 1 }] }, { note: "x".repeat(301) }]) {
      expect(validateOrderInput(order(bad)).ok, JSON.stringify(bad)).toBe(false)
    }
  })
  it("order codes look like AYA-XXXXXX with no confusing characters", () => {
    for (let i = 0; i < 50; i++) expect(makeOrderCode()).toMatch(/^AYA-[A-HJKMNP-Z2-9]{6}$/)
    expect(new Set(Array.from({ length: 200 }, () => makeOrderCode())).size).toBeGreaterThan(190)
  })
})

describe("order status path", () => {
  it("bank transfer: pending → paid → shipped → delivered; cancel only before shipping", () => {
    expect(nextStatuses("PENDING_PAYMENT", "havale")).toEqual(["PAID", "CANCELLED"])
    expect(nextStatuses("PAID", "havale")).toEqual(["SHIPPED", "CANCELLED"])
    expect(nextStatuses("SHIPPED", "havale")).toEqual(["DELIVERED"])
    expect(nextStatuses("DELIVERED", "havale")).toEqual([])
    expect(nextStatuses("CANCELLED", "havale")).toEqual([])
  })
  it("pay on delivery ships before it is paid and may be cancelled on the road", () => {
    expect(nextStatuses("PENDING_PAYMENT", "kapida")).toEqual(["SHIPPED", "CANCELLED"])
    expect(nextStatuses("SHIPPED", "kapida")).toEqual(["DELIVERED", "CANCELLED"])
    expect(canTransition("PENDING_PAYMENT", "PAID", "kapida")).toBe(false)
  })
  it("never goes backwards", () => {
    expect(canTransition("DELIVERED", "PAID", "havale")).toBe(false)
    expect(canTransition("SHIPPED", "PENDING_PAYMENT", "havale")).toBe(false)
    expect(canTransition("CANCELLED", "PAID", "havale")).toBe(false)
  })
})

const episode = (over: object = {}) => ({ title: "Nefes ve sakinlik", description: "Bu bölümde nefes çalışmasının günlük hayata etkisini konuşuyoruz.", audioUrl: "/uploads/audio/a.mp3", ...over })

describe("podcast validation", () => {
  it("accepts uploads and https links, blank optional fields become null", () => {
    const v = validatePodcastInput(episode({ coverUrl: "", guest: " ", durationSec: "", episodeNo: "" }))
    expect(v.ok && v.data).toMatchObject({ coverUrl: null, guest: null, durationSec: null, episodeNo: null, status: "DRAFT" })
    expect(validatePodcastInput(episode({ audioUrl: "https://cdn.example.com/a.mp3" })).ok).toBe(true)
    expect(validatePodcastInput(episode({ durationSec: "185", episodeNo: 3, status: "PUBLISHED", notify: true })).ok).toBe(true)
  })
  it("rejects bad input", () => {
    for (const bad of [{ title: "x" }, { description: "kısa" }, { audioUrl: "" }, { audioUrl: "javascript:alert(1)" }, { audioUrl: "/etc/passwd" }, { audioUrl: "/uploads/../../etc/passwd" }, { coverUrl: "ftp://x" }, { durationSec: 0 }, { durationSec: 1.5 }, { durationSec: 999999 }, { episodeNo: 0 }]) {
      expect(validatePodcastInput(episode(bad)).ok, JSON.stringify(bad)).toBe(false)
    }
  })
  it("formats durations", () => {
    expect(formatDuration(185)).toBe("3:05")
    expect(formatDuration(3725)).toBe("1:02:05")
    expect(formatDuration(null)).toBe("")
    expect(itunesDuration(3725)).toBe("01:02:05")
  })
  it("escapes XML for the RSS feed", () => {
    expect(xmlEscape(`<a href="x">Tom & 'Jerry'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;Tom &amp; &apos;Jerry&apos;&lt;/a&gt;")
  })
})

describe("newsletter mail", () => {
  it("escapes the text, links bare URLs and always carries the unsubscribe link", () => {
    const m = renderMail("Merhaba <script>alert(1)</script>\n\nBak: https://aya.test/podcast", "https://aya.test/bulten/ayril?t=abc", { label: "Dinle", href: "https://aya.test/podcast/x" })
    expect(m.html).not.toContain("<script>")
    expect(m.html).toContain("&lt;script&gt;")
    expect(m.html).toContain('<a href="https://aya.test/podcast"')
    expect(m.html).toContain("bulten/ayril?t=abc")
    expect(m.html).toContain("Dinle")
    expect(m.text).toContain("Abonelikten çık: https://aya.test/bulten/ayril?t=abc")
  })
})

describe("audio upload signatures", () => {
  const buf = (...b: number[]) => new Uint8Array([...b, ...new Array(40).fill(0)]).buffer
  it("recognises mp3, ogg, wav and m4a and rejects mislabelled files", () => {
    expect(validateMagicBytes(buf(0x49, 0x44, 0x33), "audio/mpeg")).toBe(true)
    expect(validateMagicBytes(buf(0xff, 0xfb, 0x90), "audio/mpeg")).toBe(true)
    expect(validateMagicBytes(buf(0x4f, 0x67, 0x67, 0x53), "audio/ogg")).toBe(true)
    expect(validateMagicBytes(buf(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45), "audio/wav")).toBe(true)
    expect(validateMagicBytes(buf(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50), "audio/wav")).toBe(false)
    expect(validateMagicBytes(buf(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70), "audio/mp4")).toBe(true)
    expect(validateMagicBytes(buf(0x89, 0x50, 0x4e, 0x47), "audio/mpeg")).toBe(false)
    expect(validateMagicBytes(buf(0x3c, 0x73, 0x63, 0x72), "audio/mpeg")).toBe(false)
  })
})
