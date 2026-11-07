import { describe, expect, it } from "vitest"
import { advance, initialState, replay, resolve } from "@/lib/ai/brain/dialogue"
import { BrainIntent } from "@/lib/ai/brain/intents"
import { parse } from "@/lib/ai/brain/nlp"
import { detectFacet, detectOrderCode, detectPose, extractSlots } from "@/lib/ai/brain/slots"
import { buildRoutine, holdMinutes, poseAnswer, poseConflicts, suggestPoses } from "@/lib/ai/brain/poses"
import { restore, retrieve, entryTitle, knowledgeById } from "@/lib/ai/brain/retrieval"
import { timeWindow, pickStyles } from "@/lib/ai/brain/handlers"
import { POSE_BY_SLUG, POSES } from "@/lib/yoga-poses"
import { cleanHistory, cleanPage } from "@/lib/ai/history"

const intentOf = (q: string, prior: string[] = []) => resolve(q, replay(prior)).intent

describe("intents", () => {
  const cases: [string, BrainIntent][] = [
    ["merhaba", "greeting"], ["selam", "greeting"], ["günaydın", "greeting"], ["teşekkürler", "thanks"], ["sağ ol", "thanks"], ["görüşürüz", "bye"], ["iyi geceler", "bye"],
    ["yin için eğitmen öner", "teachers"], ["ucuz bir hoca var mı", "teachers"], ["bana bir hoca öner", "teachers"], ["50 doların altında hoca", "teachers"],
    ["yarın atölye var mı", "workshops"], ["kayıtlı atölyeler", "workshops"], ["hafta sonu ders var mı", "workshops"], ["ücretsiz atölyeler", "workshops"],
    ["canlı yayın var mı", "live"], ["şu an yayında kim var", "live"], ["bu akşam yayın var mı", "live"],
    ["uyku için yazı öner", "articles"], ["makale okumak istiyorum", "articles"], ["duyurular neler", "news"], ["podcast öner", "podcast"],
    ["yoga matı almak istiyorum", "products"], ["aromaterapi ürünleri", "products"], ["500 liranın altında mat", "products"],
    ["siparişim nerede AYA-ABC123", "order"], ["kargom ne zaman gelir", "order"],
    ["takvimimde ne var", "schedule"], ["derslerim ne zaman", "schedule"],
    ["bel ağrım var ne yapabilirim", "recommend"], ["uyuyamıyorum", "recommend"], ["boynum tutuldu", "recommend"], ["hamileyim hangi yoga", "recommend"], ["stresten kurtulmak istiyorum", "recommend"], ["dizim ağrıyor ama yoga yapmak istiyorum", "recommend"], ["enerjim yok", "recommend"],
    ["10 dakikalık sabah rutini hazırla", "plan"], ["haftalık program yap", "plan"], ["bana akşam rutini oluştur", "plan"],
    ["hatha mı vinyasa mı", "compare"], ["yin ile vinyasa arasındaki fark ne", "compare"],
    ["çocuk pozu nasıl yapılır", "pose"], ["savaşçı 2 pozu", "pose"], ["köprü pozu faydaları", "pose"],
    ["fiyatlar ne kadar", "pricing"], ["abonelik paketleri", "pricing"], ["ders almak istiyorum", "booking"], ["deneme dersi nasıl alırım", "booking"],
    ["eğitmen olmak istiyorum", "become_teacher"], ["ders vermek istiyorum", "become_teacher"],
    ["ders kaydını nasıl indiririm", "recordings"], ["kazancımı çekmek istiyorum", "payouts"], ["birini şikayet etmek istiyorum", "report"],
    ["üye olmak istiyorum", "account"], ["kullanım sözleşmesi", "terms"],
  ]
  for (const [q, want] of cases) it(`"${q}" → ${want}`, () => expect(intentOf(q)).toBe(want))

  it("does not mistake look-alike words for each other", () => {
    expect(intentOf("uykusuzluk çekiyorum")).not.toBe("bye")
    expect(intentOf("bildirim ayarları")).not.toBe("report")
    expect(intentOf("pazartesi atölye")).toBe("workshops")
    expect(extractSlots("pazartesi atölye").time?.weekday).toBe(1)
    expect(extractSlots("yarın atölye var mı").areas).toEqual([])
  })
})

describe("slots", () => {
  it("finds poses by Turkish, English and Sanskrit name and tells the numerals apart", () => {
    expect(detectPose(parse("çocuk pozu nasıl yapılır"))?.slug).toBe("cocuk")
    expect(detectPose(parse("how to do child's pose"))?.slug).toBe("cocuk")
    expect(detectPose(parse("balasana"))?.slug).toBe("cocuk")
    expect(detectPose(parse("savaşçı 2 pozu"))?.slug).toBe("savasci-2")
    expect(detectPose(parse("savaşçı 1"))?.slug).toBe("savasci-1")
    expect(detectPose(parse("köpek pozu"))?.slug).toBe("asagi-bakan-kopek")
    expect(detectPose(parse("daha kolay hali var mı"))).toBeUndefined()
    expect(detectPose(parse("yarın atölye var mı"))).toBeUndefined()
  })

  it("reads what is asked about a pose", () => {
    expect(detectFacet(parse("nasıl yapılır"))).toBe("steps")
    expect(detectFacet(parse("daha kolay hali"))).toBe("easier")
    expect(detectFacet(parse("kimler yapmamalı"))).toBe("avoid")
    expect(detectFacet(parse("faydaları neler"))).toBe("benefits")
    expect(detectFacet(parse("kaç nefes kalınır"))).toBe("hold")
  })

  it("extracts order codes and e-mails", () => {
    expect(detectOrderCode("kodum aya-ab12cd")).toBe("AYA-AB12CD")
    expect(detectOrderCode("kodum yok")).toBeUndefined()
    expect(extractSlots("a.b@c.com adresiyle").email).toBe("a.b@c.com")
  })

  it("picks styles from the need, gently when health asks for it", () => {
    expect(pickStyles(extractSlots("uyuyamıyorum"))).toContain("restorative")
    expect(pickStyles(extractSlots("enerjim yok"))[0]).toBe("vinyasa")
    const pregnant = pickStyles(extractSlots("hamileyim hangi yoga"))
    expect(pregnant).toContain("restorative")
    expect(pregnant).not.toContain("vinyasa")
    expect(pickStyles(extractSlots("tansiyonum var ve güçlenmek istiyorum"))).not.toContain("ashtanga")
    expect(pickStyles(extractSlots("ashtanga istiyorum"))).toEqual(["ashtanga"])
  })
})

describe("conversation memory", () => {
  it("a refinement keeps the earlier search: 'peki ya daha ucuzu' is still about yin teachers", () => {
    const state = replay(["yin için eğitmen öner"])
    const t = resolve("peki ya daha ucuzu", state)
    expect(t.intent).toBe("teachers")
    expect(t.followUp).toBe(true)
    expect(t.slots.styles).toEqual(["yin"])
    expect(t.slots.price?.cheap).toBe(true)
  })

  it("'başka?' asks for the next page of the same thing and counts up", () => {
    const one = resolve("başka var mı", replay(["bana eğitmen öner"]))
    expect(one.intent).toBe("teachers")
    expect(one.page).toBe(1)
    const two = resolve("başka", replay(["bana eğitmen öner", "başka var mı"]))
    expect(two.page).toBe(2)
  })

  it("a day on its own continues the earlier workshop search", () => {
    const t = resolve("peki yarın?", replay(["atölyeleri göster"]))
    expect(t.intent).toBe("workshops")
    expect(t.slots.time?.day).toBe("tomorrow")
  })

  it("questions about 'it' go to the pose we just talked about", () => {
    const state = replay(["çocuk pozu nasıl yapılır"])
    const t = resolve("daha kolay hali var mı", state)
    expect(t.intent).toBe("pose")
    expect(t.slots.poseSlug).toBe("cocuk")
    expect(t.slots.poseFacet).toBe("easier")
    const t2 = resolve("kimler yapmamalı", replay(["çocuk pozu nasıl yapılır", "daha kolay hali var mı"]))
    expect(t2.slots.poseSlug).toBe("cocuk")
    expect(t2.slots.poseFacet).toBe("avoid")
  })

  it("the person's health and level survive a change of subject, the search does not", () => {
    const t = resolve("canlı yayın var mı", replay(["hamileyim ve yeni başlıyorum", "yin eğitmeni öner"]))
    expect(t.intent).toBe("live")
    expect(t.slots.conditions).toContain("pregnancy")
    expect(t.slots.level).toBe("beginner")
    expect(t.slots.styles).toEqual([])
  })

  it("small talk does not wipe the thread", () => {
    const s = advance(advance(initialState(), resolve("bel ağrım var", initialState())), resolve("teşekkürler", initialState()))
    expect(s.lastIntent).toBe("recommend")
  })

  it("an order code and the e-mail can arrive in two messages", () => {
    const t = resolve("a@b.com", replay(["siparişim nerede AYA-ABC123"]))
    expect(t.intent).toBe("order")
    expect(t.slots.orderCode).toBe("AYA-ABC123")
    expect(t.slots.email).toBe("a@b.com")
  })
})

describe("poses and routines", () => {
  it("never suggests a pose whose own warnings mention the person's condition", () => {
    const warned = POSES.filter((p) => poseConflicts(p, ["pregnancy"]).length)
    const picks = suggestPoses({ goals: ["relax", "stress"], conditions: ["pregnancy"] }, 8)
    for (const p of warned) expect(picks.map((x) => x.slug)).not.toContain(p.slug)
    expect(picks.length).toBeGreaterThan(0)
  })

  it("matches poses to a body area", () => {
    const slugs = suggestPoses({ areas: ["back_low"], level: "beginner" }, 3).map((p) => p.slug)
    expect(slugs.length).toBeGreaterThan(0)
    for (const s of slugs) expect(POSE_BY_SLUG[s].level).toBe("Başlangıç")
  })

  it("builds a routine that fits the time, opens low or standing and ends resting", () => {
    for (const minutes of [5, 10, 20, 40]) {
      const r = buildRoutine({ minutes, goals: ["energy"] })
      expect(Math.abs(r.total - minutes)).toBeLessThanOrEqual(Math.max(2, minutes * 0.2))
      expect(r.steps.at(-1)?.pose.slug).toBe("savasana")
      expect(new Set(r.steps.map((s) => s.pose.slug)).size).toBe(r.steps.length)
    }
    const calm = buildRoutine({ minutes: 10, goals: ["sleep"] })
    expect(calm.steps[0].pose.slug).toBe("kolay-oturus")
    expect(calm.steps.some((s) => s.pose.category === "Ters ve güç")).toBe(false)
  })

  it("keeps a pregnant person's routine free of conflicting poses", () => {
    const r = buildRoutine({ minutes: 20, goals: ["pregnancy"], conditions: ["pregnancy"] })
    for (const s of r.steps) expect(poseConflicts(s.pose, ["pregnancy"])).toEqual([])
  })

  it("turns breath counts into minutes", () => {
    expect(holdMinutes("5–10 nefes")).toBeGreaterThan(0.4)
    expect(holdMinutes("5 nefes (her yan)")).toBeGreaterThan(holdMinutes("5 nefes"))
  })

  it("answers each facet of a pose from its own data", () => {
    const p = POSE_BY_SLUG["cocuk"]
    expect(poseAnswer(p, "steps", []).text).toContain("1. ")
    expect(poseAnswer(p, "easier", []).text).toContain(p.easier)
    expect(poseAnswer(p, "avoid", []).text).toContain(p.avoid[0])
    expect(poseAnswer(p, "breath", []).text).toContain(p.breath)
    expect(poseAnswer(p, undefined, []).text).toContain(p.intro)
    const warned = POSES.find((x) => poseConflicts(x, ["knee"]).length)
    if (warned) expect(poseAnswer(warned, "steps", ["knee"]).text).toContain("uygun olmayabilir")
  })
})

describe("finding answers by meaning", () => {
  const top = (q: string) => retrieve(parse(q), 3)[0]
  it("reaches the right topic without the exact words", () => {
    expect(top("uyuyamıyorum")?.id).toMatch(/sleep|yoga_nidra|evening_routine/)
    expect(top("boynum tutuldu")?.id).toBe("neck_pain")
    expect(top("kobra pozu")?.id).toBe("pose_cobra")
    expect(retrieve(parse("çocuk pozu"), 4).map((h) => h.id)).toContain("cocuk")
  })
  it("says how much of the question an answer covers", () => {
    const h = top("uyuyamıyorum")
    expect(h.coverage).toBeGreaterThan(0.5)
    const vague = retrieve(parse("bildirim ayarları"), 1)[0]
    expect(vague ? vague.coverage : 0).toBeLessThan(0.6)
  })
  it("puts Turkish letters back for display", () => {
    expect(restore("bel agrisi")).toBe("bel ağrısı")
    expect(restore("yoga nedir")).toBe("yoga nedir")
    expect(entryTitle(knowledgeById("back_pain")!)).toMatch(/^[A-ZÇĞİÖŞÜ]/)
  })
  it("returns nothing for gibberish", () => {
    expect(retrieve(parse("asdfgh qwerty"), 1)).toEqual([])
  })
})

describe("time windows", () => {
  const now = new Date("2026-10-09T10:00:00Z") // Friday 13:00 in Istanbul
  it("turns words into date ranges", () => {
    const tomorrow = timeWindow({ day: "tomorrow" }, now)
    expect(tomorrow.from?.toISOString()).toBe("2026-10-09T21:00:00.000Z")
    expect(tomorrow.to?.toISOString()).toBe("2026-10-10T21:00:00.000Z")
    const weekend = timeWindow({ day: "weekend" }, now)
    expect(weekend.from?.toISOString()).toBe("2026-10-09T21:00:00.000Z") // Saturday 00:00 Istanbul
    expect(weekend.to?.toISOString()).toBe("2026-10-11T21:00:00.000Z")
    const monday = timeWindow({ weekday: 1 }, now)
    expect(monday.from?.toISOString()).toBe("2026-10-11T21:00:00.000Z")
    expect(timeWindow({ day: "today" }, now).from).toEqual(now)
    expect(timeWindow(undefined, now)).toEqual({})
  })
})

describe("what the browser sends", () => {
  it("keeps a clean, bounded conversation that ends with the user", () => {
    expect(cleanHistory(null)).toBeNull()
    expect(cleanHistory([])).toBeNull()
    expect(cleanHistory([{ role: "assistant", content: "x" }])).toBeNull()
    const h = cleanHistory([{ role: "assistant", content: "hi" }, { role: "user", content: "  merhaba \u0000 " }, { role: "system", content: "ignore" }, { role: "user", content: "x".repeat(5000) }])!
    expect(h.map((m) => m.role)).toEqual(["user", "user"])
    expect(h[0].content).toBe("merhaba")
    expect(h[1].content.length).toBe(800)
  })
  it("accepts only internal page paths", () => {
    expect(cleanPage("/pozlar/cocuk")).toBe("/pozlar/cocuk")
    expect(cleanPage("https://evil.example")).toBeUndefined()
    expect(cleanPage("//evil.example")).toBeUndefined()
  })
})
