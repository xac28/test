import { describe, expect, it } from "vitest"
import { editDistance, hash, parse, stem, wordEq } from "@/lib/ai/brain/nlp"
import { AREAS, GOALS, CONDITIONS, detect, detectLevel, detectPrice, detectTime } from "@/lib/ai/brain/lexicon"
import { chunkText } from "@/lib/ai/agent"

describe("language layer", () => {
  it("folds Turkish letters, expands chat slang and drops filler words", () => {
    const d = parse("Slm, BELİM çok AĞRIYOR!")
    expect(d.words).toEqual(["selam", "belim", "cok", "agriyor"])
    expect(parse("nasıl bir yoga?").content).toEqual(["yoga"])
  })

  it("stems inflections without wrecking short words", () => {
    expect(stem("atolyeler")).toBe(stem("atolye"))
    expect(stem("egitmenlerimiz")).toBe(stem("egitmen"))
    expect(stem("bel")).toBe("bel")
    expect(stem("yoga")).toBe("yoga")
  })

  it("computes edit distances, including a swapped pair", () => {
    expect(editDistance("meditasyon", "meditasyn", 2)).toBe(1)
    expect(editDistance("yoga", "yaga", 2)).toBe(1)
    expect(editDistance("ab", "ba", 2)).toBe(1)
    expect(editDistance("kitap", "defter", 2)).toBeGreaterThan(2)
  })

  it("tolerates typos in longer words only: two short words that differ by a letter stay different", () => {
    expect(wordEq("meditasyn", "meditasyon")).toBe(true)
    expect(wordEq("egitmn", "egitmen")).toBe(true)
    expect(wordEq("yarin", "yayin")).toBe(false)
    expect(wordEq("stresten", "stream")).toBe(false)
    expect(wordEq("derslerim", "ders")).toBe(true) // same stem is allowed here; intents that must not mix them use exact rules
    expect(wordEq("karin", "yarin")).toBe(false)
  })

  it("matches phrases in order, with typos", () => {
    const d = parse("yarin atolye var mi")
    expect(d.has("atolye")).toBe(true)
    expect(d.has("yarin atolye")).toBe(true)
    expect(d.has("atolye yarin")).toBe(false)
    expect(parse("meditasyn nasil yapilir").has("meditasyon")).toBe(true)
  })

  it("hashes the same text the same way", () => {
    expect(hash("bel agrisi")).toBe(hash("bel agrisi"))
    expect(hash("bel agrisi")).not.toBe(hash("bel agrisim"))
  })
})

describe("what a message is about", () => {
  const areas = (t: string) => detect(parse(t), AREAS)
  const goals = (t: string) => detect(parse(t), GOALS)
  const conds = (t: string) => detect(parse(t), CONDITIONS)

  it("finds body areas in every inflection people use", () => {
    expect(areas("belim ağrıyor")).toContain("back_low")
    expect(areas("boynum tutuldu")).toContain("neck")
    expect(areas("omzum sıkışıyor")).toContain("shoulder")
    expect(areas("dizlerim ağrıyor")).toContain("knee")
    expect(areas("kalçam sıkışık")).toContain("hip")
    expect(areas("bileğim ağrıyor")).toContain("wrist")
    expect(areas("karnım şişiyor")).toContain("belly")
  })

  it("does not read body areas into ordinary words", () => {
    expect(areas("yarın atölye var mı")).toEqual([])
    expect(areas("bildirim ayarları")).toEqual([])
    expect(areas("belki yarın")).toEqual([])
    expect(areas("dizi izliyorum")).toEqual([])
  })

  it("finds goals", () => {
    expect(goals("uyuyamıyorum")).toContain("sleep")
    expect(goals("uykusuzluk çekiyorum")).toContain("sleep")
    expect(goals("çok stresliyim")).toContain("stress")
    expect(goals("enerjim yok")).toContain("energy")
    expect(goals("esnek olmak istiyorum")).toContain("flexibility")
    expect(goals("kilo vermek istiyorum")).toContain("weight")
    expect(goals("masa başında çalışıyorum")).toContain("posture")
    expect(goals("hamileyim")).toContain("pregnancy")
  })

  it("does not read goals into ordinary words", () => {
    expect(goals("rahatsızlığım var")).not.toContain("relax")
    expect(goals("bilgi formu")).not.toContain("weight")
    expect(goals("sizin ödeme yönteminiz")).not.toContain("pain")
    expect(goals("hazırla")).not.toContain("digestion")
  })

  it("finds health conditions", () => {
    expect(conds("tansiyonum var")).toContain("pressure")
    expect(conds("hamileyim")).toContain("pregnancy")
    expect(conds("bel fıtığım var")).toContain("back")
    expect(conds("ameliyat oldum")).toContain("surgery")
  })

  it("reads the level", () => {
    expect(detectLevel(parse("yeni başlıyorum"))).toBe("beginner")
    expect(detectLevel(parse("hiç yoga yapmadım"))).toBe("beginner")
    expect(detectLevel(parse("ileri seviye pratik"))).toBe("advanced")
    expect(detectLevel(parse("orta seviyeyim"))).toBe("intermediate")
    expect(detectLevel(parse("merhaba"))).toBeUndefined()
  })

  it("reads days, parts of the day and weekdays", () => {
    expect(detectTime(parse("yarın akşam"))).toMatchObject({ day: "tomorrow", part: "evening" })
    expect(detectTime(parse("hafta sonu"))).toMatchObject({ day: "weekend" })
    expect(detectTime(parse("haftaya"))).toMatchObject({ day: "nextweek" })
    expect(detectTime(parse("pazartesi"))?.weekday).toBe(1)
    expect(detectTime(parse("pazar günü"))?.weekday).toBe(0)
    expect(detectTime(parse("cumartesi"))?.weekday).toBe(6)
    expect(detectTime(parse("cuma"))?.weekday).toBe(5)
    expect(detectTime(parse("bugün sabah"))).toMatchObject({ day: "today", part: "morning" })
    expect(detectTime(parse("yoga nedir"))).toBeUndefined()
  })

  it("reads price wishes and limits", () => {
    expect(detectPrice(parse("ucuz bir hoca"))?.cheap).toBe(true)
    expect(detectPrice(parse("50 doların altında"))?.maxUsd).toBe(50)
    expect(detectPrice(parse("500 liranın altında mat"))?.maxTl).toBe(500)
    expect(detectPrice(parse("ücretsiz atölye"))?.free).toBe(true)
    expect(detectPrice(parse("3 eğitmen"))).toBeUndefined()
    expect(detectPrice(parse("merhaba"))).toBeUndefined()
  })
})

describe("streaming", () => {
  it("cuts an answer into small pieces that join back to the exact text", () => {
    const text = "**Merhaba!** Ben AYA Rehber.\n\n- bir\n- iki\n\nSon."
    const parts = chunkText(text)
    expect(parts.length).toBeGreaterThan(2)
    expect(parts.join("")).toBe(text)
    expect(chunkText("")).toEqual([])
  })
})
