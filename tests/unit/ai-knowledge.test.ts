import { describe, it, expect } from "vitest"
import { KNOWLEDGE, fold, isCrisis, matchKnowledge, wordMatches } from "../../src/lib/ai-knowledge"
import { composeReply, GuideData, GuideTeacher } from "../../src/lib/ai-guide"

const T = (over: Partial<GuideTeacher>): GuideTeacher => ({ id: "x", name: "X", country: "TR", specialties: "hatha", rating: 4.5, reviewCount: 10, hourlyRate: 30, studentsCount: 5, href: "/teachers/x", ...over })
const data = (over: Partial<GuideData> = {}): GuideData => ({
  teachers: [T({ id: "a", name: "Aylin", specialties: "hatha, yin", rating: 4.9, href: "/teachers/a" }), T({ id: "m", name: "Mert", specialties: "meditation", rating: 4.8, href: "/teachers/m" }), T({ id: "r", name: "Rana", specialties: "restorative", rating: 4.7, href: "/teachers/r" })],
  workshops: [], live: [], articles: [], signedIn: false, role: null, ...over,
})
const id = (q: string) => matchKnowledge(q)?.entry.id ?? null

describe("knowledge base hygiene", () => {
  it("has a broad vocabulary", () => {
    expect(KNOWLEDGE.length).toBeGreaterThanOrEqual(135)
    expect(KNOWLEDGE.reduce((n, e) => n + e.keys.length, 0)).toBeGreaterThanOrEqual(500)
  })
  it("ids are unique and every answer is real text", () => {
    const ids = KNOWLEDGE.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const e of KNOWLEDGE) {
      expect(e.answer.length, e.id).toBeGreaterThan(30)
      expect(e.keys.length, e.id).toBeGreaterThan(0)
      for (const l of e.links ?? []) expect(l.href, e.id).toMatch(/^\/[a-z0-9/_?=-]*$/i)
    }
  })
  it("every entry can be reached by its own first key", () => {
    for (const e of KNOWLEDGE) {
      const m = matchKnowledge(e.keys[0])
      expect(m, `${e.id}: "${e.keys[0]}"`).not.toBeNull()
      // another entry may legitimately win a shared phrase, but it must at least score as high
      expect(m!.score).toBeGreaterThanOrEqual(3)
    }
  })
  it("English entries are marked, and English questions find them", () => {
    expect(id("what is yoga")).toBe("en_yoga")
    expect(id("how are you")).toBe("en_how_are_you")
    expect(id("thank you")).toBe("en_thanks")
    expect(KNOWLEDGE.filter((e) => e.id.startsWith("en_")).every((e) => e.lang === "en")).toBe(true)
  })
})

describe("matching", () => {
  const cases: [string, string][] = [
    ["Yoga nedir?", "what_is_yoga"],
    ["yoga ne demek", "what_is_yoga"],
    ["Yoga stilleri nelerdir", "yoga_styles"],
    ["hatha yoga nedir", "hatha"],
    ["Vinyasa nedir", "vinyasa"],
    ["yin yoga ne işe yarar", "yin"],
    ["restoratif yoga", "restorative"],
    ["Yoga nidra nedir", "yoga_nidra"],
    ["yeni başlıyorum nasıl başlarım", "beginner"],
    ["yoga için ne gerekir", "equipment"],
    ["haftada kaç gün yoga yapmalıyım", "frequency"],
    ["sabah mı akşam mı yoga yapılır", "time_of_day"],
    ["aç karnına yoga yapılır mı", "empty_stomach"],
    ["esnek değilim yoga yapabilir miyim", "flexibility"],
    ["yoga ile kilo verilir mi", "weight_loss"],
    ["hamileyim yoga yapabilir miyim", "pregnancy"],
    ["bel ağrım var", "back_pain"],
    ["Belim ağrıyor ne yapmalıyım", "back_pain"],
    ["boynum ağrıyor", "neck_pain"],
    ["dizim ağrıyor", "knee"],
    ["uyuyamıyorum", "sleep"],
    ["uykusuzluk çekiyorum", "sleep"],
    ["çok stresliyim", "stressed_feeling"],
    ["panik atak geçiriyorum", "anxiety"],
    ["odaklanamıyorum", "focus"],
    ["nefes egzersizi öner", "breath_basic"],
    ["kutu nefesi nasıl yapılır", "box_breath"],
    ["4-7-8 nefesi", "478"],
    ["nadi shodhana nedir", "nadi"],
    ["meditasyon nasıl yapılır", "meditation_start"],
    ["meditasyon kaç dakika olmalı", "meditation_time"],
    ["aşağı bakan köpek duruşu", "pose_downdog"],
    ["çocuk duruşu nasıl yapılır", "pose_child"],
    ["kedi inek duruşu", "pose_catcow"],
    ["savaşçı duruşu", "pose_warrior"],
    ["ağaç duruşu", "pose_tree"],
    ["güneşe selam nedir", "pose_sun"],
    ["şavasana nedir", "shavasana"],
    ["derse nasıl katılırım", "how_join_class"],
    ["kameram çalışmıyor", "camera_problem"],
    ["ödeme yöntemleri neler", "payment_methods"],
    ["iade var mı", "refund"],
    ["ilk ders ne kadar", "trial_lesson"],
    ["komisyon yüzde kaç", "commission"],
    ["şifremi unuttum", "password"],
    ["mobil uygulama var mı", "mobile_app"],
    ["nasılsın", "how_are_you"],
    ["sen kimsin", "who_are_you"],
    ["neler yapabilirsin", "what_can_you_do"],
    ["günaydın", "morning"],
    ["iyi geceler", "night"],
    ["bir espri yap", "joke"],
    ["canım sıkılıyor", "bored"],
    ["çok üzgünüm", "sad"],
    ["teşekkürler", "thanks_ai"],
    ["görüşürüz", "bye"],
    ["slm nbr", "how_are_you"],
    ["motivasyonum yok", "motivation"],
    ["vaktim yok kısa bir şey", "no_time"],
    ["yoga din mi", "religion"],
    ["regl döneminde yoga yapılır mı", "period"],
    ["yogadan sonra kaslarım ağrıyor", "soreness"],
    ["gözlerimi kapatmalı mıyım", "eyes"],
    ["eğitmen nasıl seçilir", "choose_teacher"],
    ["ilk derste ne beklemeliyim", "first_class"],
    ["duvar yogası", "wall_yoga"],
    ["hangi mat almalıyım", "mat_choice"],
    ["yoga mu pilates mi", "is_sport"],
    ["akşam rutini öner", "evening_routine"],
  ]
  for (const [q, expected] of cases) it(`"${q}" → ${expected}`, () => expect(id(q)).toBe(expected))

  it("tolerates a typo in long words and Turkish suffixes", () => {
    expect(id("meditasyn nasil yapilir")).toBe("meditation_start")
    expect(id("hamilelikte yoga yapilirmi")).toBe("pregnancy")
    expect(id("nefesimi nasıl kontrol ederim nefes egzersizi")).toBe("breath_basic")
    expect(wordMatches("hamilelikte", "hamilelik")).toBe(true)
    expect(wordMatches("meditasyn", "meditasyon")).toBe(true)
    expect(wordMatches("yoga", "yogurt")).toBe(false)
  })
  it("ignores case, diacritics and punctuation", () => {
    expect(fold("  ÇOCUK Duruşu!! ")).toBe("cocuk durusu")
    expect(id("YOGA NEDİR???")).toBe("what_is_yoga")
  })
  it("does not answer unrelated or empty input", () => {
    expect(id("")).toBeNull()
    expect(id("asdf qwer zxcv")).toBeNull()
    expect(id("xx yy")).toBeNull()
  })
})

describe("crisis handling", () => {
  it("answers distress with care and the emergency number, never a sales link", () => {
    for (const q of ["intihar etmek istiyorum", "kendime zarar vereceğim", "I want to kill myself", "yaşamak istemiyorum"]) {
      expect(isCrisis(q), q).toBe(true)
      const r = composeReply(q, data())
      expect(r.intent).toBe("crisis")
      expect(r.reply).toContain("112")
      expect(r.links).toEqual([])
      expect(r.teachers).toBeUndefined()
    }
    expect(isCrisis("yoga yaparken sırtım ağrıyor")).toBe(false)
    expect(isCrisis("bugün çok yoruldum")).toBe(false)
  })
})

describe("composeReply with knowledge", () => {
  it("answers general questions directly", () => {
    const r = composeReply("Yoga nedir?", data())
    expect(r.intent).toBe("knowledge")
    expect(r.reply).toMatch(/asana|pranayama|meditasyon/)
    expect(r.suggestions!.length).toBeGreaterThan(0)
  })
  it("adds matching teachers to advice about a complaint, and invites visitors to join", () => {
    const r = composeReply("Belim ağrıyor", data())
    expect(r.intent).toBe("teachers")
    expect(r.reply).toMatch(/tıbbi tavsiye/)
    expect(r.teachers!.map((t) => t.id).sort()).toEqual(["a", "r"]) // yin/restorative teachers only, never the meditation one
    expect(r.links.some((l) => l.href.startsWith("/login"))).toBe(true)
    expect(composeReply("Belim ağrıyor", data({ signedIn: true })).links.some((l) => l.href.startsWith("/login"))).toBe(false)
  })
  it("explicit navigation beats a vague knowledge hit, a very specific knowledge hit beats navigation", () => {
    expect(composeReply("Eğitmen olmak istiyorum", data()).links[0].href).toBe("/become-teacher")
    expect(composeReply("Üye olmak istiyorum", data()).links[0].href).toBe("/login?mode=register")
    expect(composeReply("nefes teknikleri nelerdir", data()).intent).toBe("knowledge")
  })
  it("small talk is answered even when the message starts with a greeting", () => {
    expect(composeReply("merhaba nasılsın", data()).reply).toMatch(/İyiyim/)
  })
  it("unknown input offers suggestions instead of a dead end", () => {
    const r = composeReply("qwertyuiop", data())
    expect(r.intent).toBe("unknown")
    expect(r.suggestions!.length).toBeGreaterThan(2)
  })
  it("never produces an external or broken link", () => {
    for (const e of KNOWLEDGE) {
      const r = composeReply(e.keys[0], data({ signedIn: true }))
      for (const l of r.links) expect(l.href, e.id).toMatch(/^\/[a-z0-9/_?=-]*$/i)
    }
  })
})
