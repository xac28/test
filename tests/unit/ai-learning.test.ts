import { describe, it, expect } from "vitest"
import { keysFromInput, keysFromQuestion, redactForLog, safeHref, taughtToEntries } from "../../src/lib/ai-learning"
import { matchTaught } from "../../src/lib/ai-knowledge"
import { composeReply, detectIntent, wantsHuman, GuideData } from "../../src/lib/ai-guide"

const data: GuideData = { teachers: [], workshops: [], live: [], articles: [], signedIn: true, role: "STUDENT" }

describe("keys for a taught answer", () => {
  it("takes the meaningful words of the question", () => {
    expect(keysFromQuestion("İade politikası nasıl işliyor?")[0].split(" ")).toEqual(expect.arrayContaining(["iade", "politikasi", "isliyor"]))
    expect(keysFromQuestion("ve bu mi")).toEqual([])
  })
  it("accepts admin keywords, folded and de-duplicated", () => {
    expect(keysFromInput("İade, para iadesi; İADE\nGeri ödeme")).toEqual(["iade", "para iadesi", "geri odeme"])
    expect(keysFromInput(42)).toEqual([])
  })
})

describe("matching taught answers", () => {
  const entries = taughtToEntries([{ id: "a", keys: JSON.stringify(["iade politikasi"]), answer: "14 gün içinde iade.", linkLabel: "Şartlar", linkHref: "/terms" }])
  it("finds it even with inflection and extra words", () => {
    expect(matchTaught("İade politikanız nedir acaba?", entries)?.entry.id).toBe("a")
    expect(matchTaught("Bugün hava çok güzel", entries)).toBeNull()
  })
  it("carries the link", () => {
    expect(entries[0].links).toEqual([{ label: "Şartlar", href: "/terms" }])
  })
})

describe("safe links", () => {
  it("accepts same-site paths and https only", () => {
    expect(safeHref("/pricing")).toBe("/pricing")
    expect(safeHref("https://example.com/a?b=1")).toBe("https://example.com/a?b=1")
    for (const bad of ["javascript:alert(1)", "//evil.com", "http://example.com", "data:text/html,x", "/a b", ""]) expect(safeHref(bad), bad).toBeNull()
  })
})

describe("what is stored of a question", () => {
  it("masks contact details", () => {
    const r = redactForLog("ali@example.com ve 0532 123 45 67 numarası, IBAN TR12 3456 7890 1234 5678 9012 34")
    expect(r).not.toMatch(/ali@|0532|3456/)
    expect(r).toContain("[e-posta]")
  })
})

describe("asking for a human", () => {
  it("is detected and answered with the support action", () => {
    for (const m of ["canlı destek", "Canlı desteğe bağlanmak istiyorum", "yetkiliyle konuşmak istiyorum", "müşteri temsilcisi lazım", "talk to a person", "customer service"]) {
      expect(wantsHuman(m), m).toBe(true)
      expect(detectIntent(m)).toBe("support")
      expect(composeReply(m, data).action).toBe("support")
    }
  })
  it("does not trigger on ordinary questions", () => {
    for (const m of ["Yoga nedir?", "insan vücudu için hangi yoga iyi", "destek çorabı önerir misin"]) expect(wantsHuman(m), m).toBe(false)
  })
  it("tells a signed-out visitor to sign in first", () => {
    const r = composeReply("canlı destek", { ...data, signedIn: false })
    expect(r.links.some((l) => l.href.startsWith("/login"))).toBe(true)
  })
  it("an unknown question is acknowledged as a gap", () => {
    const r = composeReply("qwxzv plmkn bhgty", data)
    expect(r.intent).toBe("unknown")
    expect(r.learning).toBe(true)
  })
})
