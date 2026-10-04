import { describe, it, expect } from "vitest"
import { composeReply, detectIntent, detectStyles, normalize, rankTeachers, GuideData, GuideTeacher } from "../../src/lib/ai-guide"

const T = (over: Partial<GuideTeacher>): GuideTeacher => ({ id: "x", name: "X", country: "TR", specialties: "hatha", rating: 4.5, reviewCount: 10, hourlyRate: 30, studentsCount: 5, href: "/teachers/x", ...over })
const data = (over: Partial<GuideData> = {}): GuideData => ({
  teachers: [T({ id: "a", name: "Aylin", specialties: "hatha, yin", rating: 4.9, hourlyRate: 25, href: "/teachers/a" }), T({ id: "b", name: "Mert", specialties: "vinyasa", rating: 4.6, hourlyRate: 20, href: "/teachers/b" }), T({ id: "c", name: "Deniz", specialties: "meditation", rating: 4.8, hourlyRate: 40, href: "/teachers/c" })],
  workshops: [{ title: "Sabah Nefesi", slug: "sabah-nefesi", category: "Hatha", startsAt: new Date(Date.now() + 86_400_000).toISOString(), priceUsd: 0, mode: "LIVE" }],
  live: [], articles: [{ title: "Nefes üzerine", slug: "nefes", category: "Nefes" }], signedIn: false, role: null, ...over,
})

describe("normalize", () => {
  it("folds Turkish letters and punctuation", () => {
    expect(normalize("  Eğitmen OLMAK, istiyorum!! ")).toBe("egitmen olmak istiyorum")
    expect(normalize("İŞ ÇÖZÜM Ğ")).toBe("is cozum g")
  })
})

describe("detectIntent", () => {
  const cases: [string, string][] = [
    ["Eğitmen olmak istiyorum", "become_teacher"],
    ["ders vermek istiyorum", "become_teacher"],
    ["I want to teach yoga", "become_teacher"],
    ["Üye olmak istiyorum", "account"],
    ["kayıt ol", "account"],
    ["Canlı yayın var mı?", "live"],
    ["Şu an yayında kim var", "live"],
    ["Atölyeleri göster", "workshops"],
    ["workshop var mı", "workshops"],
    ["nefes üzerine yazılar", "articles"],
    ["Paket fiyatları nedir", "pricing"],
    ["Ders kaydımı nasıl indiririm?", "recordings"],
    ["ödeme talebi nasıl oluştururum", "payouts"],
    ["kazancımı çekmek istiyorum", "payouts"],
    ["Bir kullanıcıyı şikayet etmek istiyorum", "report"],
    ["rezervasyon nasıl yapılır", "booking"],
    ["Bel ağrım için hangi yoga?", "teachers"],
    ["stresim çok, uyku problemi", "teachers"],
    ["Sözleşmeyi okumak istiyorum", "terms"],
    ["merhaba", "greeting"],
    ["tesekkurler", "thanks"],
    ["asdf qwer", "unknown"],
    ["", "unknown"],
  ]
  for (const [q, intent] of cases) it(`"${q}" → ${intent}`, () => expect(detectIntent(q)).toBe(intent))
})

describe("styles and ranking", () => {
  it("maps complaints to styles", () => {
    expect(detectStyles("bel ağrım var")).toContain("restorative")
    expect(detectStyles("stresliyim")).toContain("meditation")
    expect(detectStyles("kilo vermek istiyorum")).toContain("vinyasa")
    expect(detectStyles("hiçbir şey")).toEqual([])
  })
  it("ranks by rating inside the matching style, or by price when the visitor wants cheap", () => {
    const d = data().teachers
    expect(rankTeachers(d, "meditasyon").teachers.map((t) => t.id)).toEqual(["c"])
    expect(rankTeachers(d, "yoga öner").teachers[0].id).toBe("a")
    expect(rankTeachers(d, "ucuz yoga hocası").teachers[0].id).toBe("b")
    expect(rankTeachers([], "yoga").teachers).toEqual([])
  })
})

describe("composeReply", () => {
  it("recommends teachers with working profile links", () => {
    const r = composeReply("başlangıç için yoga hocası", data())
    expect(r.intent).toBe("teachers")
    expect(r.teachers![0].href).toMatch(/^\/teachers\//)
    expect(r.links.some((l) => l.href === "/teachers")).toBe(true)
  })
  it("offers sign-up to visitors, not to members", () => {
    expect(composeReply("atölyeleri göster", data()).links.some((l) => l.href.startsWith("/login"))).toBe(true)
    expect(composeReply("atölyeleri göster", data({ signedIn: true })).links.some((l) => l.href.startsWith("/login"))).toBe(false)
    expect(composeReply("üye olmak istiyorum", data()).links[0].href).toBe("/login?mode=register")
    expect(composeReply("üye olmak istiyorum", data({ signedIn: true })).links[0].href).toBe("/dashboard")
  })
  it("live: links to the running streams, or says there is none", () => {
    expect(composeReply("canlı yayın var mı", data()).reply).toMatch(/yayın yok/)
    const r = composeReply("canlı yayın var mı", data({ live: [{ id: "L1", title: "Sabah", teacher: "Aylin" }] }))
    expect(r.links[0].href).toBe("/live/L1")
  })
  it("teacher-specific answers follow the role", () => {
    expect(composeReply("eğitmen olmak istiyorum", data()).links[0].href).toBe("/become-teacher")
    expect(composeReply("eğitmen olmak istiyorum", data({ role: "TEACHER" })).links[0].href).toBe("/teach")
    expect(composeReply("ödeme talebi", data({ role: "TEACHER" })).links[0].href).toBe("/teach/earnings")
    expect(composeReply("ödeme talebi", data()).links[0].href).toBe("/become-teacher")
  })
  it("report guidance points to the notification page for members", () => {
    expect(composeReply("şikayet etmek istiyorum", data({ signedIn: true })).links[0].href).toBe("/dashboard/reports")
  })
  it("unknown input still helps", () => {
    const r = composeReply("qwerty", data())
    expect(r.intent).toBe("unknown")
    expect(r.links.length).toBeGreaterThan(0)
  })
  it("every link is an internal absolute path", () => {
    for (const q of ["merhaba", "yoga", "atölye", "canlı", "yazı", "fiyat", "eğitmen ol", "kayıt indir", "ödeme talebi", "şikayet", "üye ol", "sözleşme", "ders al", "xx"]) {
      for (const l of composeReply(q, data()).links) expect(l.href, q).toMatch(/^\/[a-z0-9/_-]*(\?mode=register)?$/i)
    }
  })
})
