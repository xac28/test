import { describe, it, expect } from "vitest"
import { findContact, findSpamShape, maskText, scanText, tokenize } from "../../src/lib/profanity"

const bad = (t: string, extra: string[] = []) => !scanText(t, extra).clean
const ok = (t: string) => scanText(t).clean

describe("catches profanity, including the usual tricks", () => {
  const caught = [
    "siktir git", "SİKTİR", "SIKTIR", "siktir lan", "siktirgit", "siiiiiktir", "s.i.k.t.i.r", "s i k t i r", "s_i_k_t_i_r", "s*i*k*t*i*r", "$1kt1r", "s1kt1r", "$iktir", "sikerim seni", "sikeyim", "sikecem",
    "orospu çocuğu", "orospu", "oruspu cocugu", "0r0spu", "amcık", "amcik", "AMK", "amk", "aq", "amq", "amına koyayım", "amina koyim", "aminakoyim", "amkoyim", "amına sokayım",
    "yarrak", "yarak", "yarraaaak", "dalyarak", "göt", "götün", "götveren", "gotveren", "gotlek",
    "pezevenk", "p3zevenk", "gavat", "kahpe", "kaltak", "yavşak", "ibne", "piç", "pic kurusu", "puşt",
    "fuck you", "fuuuck", "f u c k", "fck this", "shit", "bullshit", "sh1t", "bitch", "asshole", "bastard", "cunt", "whore", "slut", "motherfucker", "dickhead", "pussy", "wanker",
    "you nigger", "faggot", "retard", "ne gavur", "pis cingene",
    "aptal", "Seni aptal salak!", "sen bir aptalsın", "salaksın", "ahmak", "budala", "you idiot", "stupid moron", "loser",
    "şerefsiz", "serefsizler", "haysiyetsiz", "gerizekalı", "gerizekali", "dangalak", "mal herif", "it oğlu it",
    "seni öldüreceğim", "seni gebertirim", "geber", "kys", "kill yourself", "i will kill you",
    "bugün çok güzel ama siktir et", "hocam hello siktir", "BU DERS FUCK",
  ]
  for (const t of caught) it(`blocks: ${t}`, () => expect(bad(t)).toBe(true))

  it("uses the admins' extra words, with suffixes", () => {
    expect(bad("bu kelime yasakli", ["yasakli"])).toBe(true)
    expect(bad("yasaklilar", ["yasakli"])).toBe(true)
    expect(bad("normal metin", ["yasakli"])).toBe(false)
    // words typed with digits are matched like the text is
    expect(bad("bu zzkelime123456 çok", ["zzkelime123456"])).toBe(true)
  })
})

describe("does not punish innocent words", () => {
  const innocent = [
    "salaka yapıyorduk", "salakalaşmak güzel", "idiom", "a stupidity-free zone".replace("stupidity", "calm"), "Moroni", "Moronto",
    "sıkıntı yok", "sıktı beni", "canım sıkıldı", "sıkıştı", "sık sık pratik yapıyorum", "sıkı bir ders", "sıkça soruluyor", "sikayet etmek istiyorum", "şikayet", "sikke", "siklet",
    "Amerika'ya gideceğim", "amca geldi", "amel", "ambulans", "amiral", "aminoasit", "Amina Hanım harika bir öğretmen", "ananı ara", "ananas",
    "götür beni", "götürdü", "got it", "I got it", "picture perfect", "pic", "Sanjay Kumar harika", "Moby Dick",
    "class", "classic", "assistant", "grass", "pass", "bass", "cockpit", "cocktail", "shiitake", "Scunthorpe", "Niger", "Nigeria", "night", "nightmare", "fagot",
    "Pazartesi sabah yogası", "nefes alırken kollarını yukarı uzat", "Yoga yaparken omuzlarımı gevşetiyorum", "teşekkürler hocam çok iyiydi", "harika bir ders, çok keyif aldım",
    "hamilelikte yapılır mı", "ders saati kaçta", "kumsalda yoga", "kumaş mat", "dalyan", "ocak ayında başlıyorum", "pusula", "assist",
    "Çok güzel bir pratikti 🙏", "Harika!", "Kamera açılıyor mu?", "bel ağrım için hangi yoga iyi?", "ilk ders ücretsiz mi",
  ]
  for (const t of innocent) it(`allows: ${t}`, () => expect(ok(t), JSON.stringify(scanText(t).matches)).toBe(true))
})

describe("tokenizer and masking", () => {
  it("glues spaced letters but leaves short normal sentences alone", () => {
    expect(tokenize("s i k t i r").map((t) => t.token)).toEqual(["siktir"])
    expect(tokenize("a b").map((t) => t.token)).toEqual(["a", "b"])
    expect(tokenize("ben o gün 5 ders yaptım").length).toBeGreaterThan(3)
  })
  it("masks what it found", () => {
    expect(maskText("siktir git buradan")).toBe("s***** git buradan")
    expect(maskText("merhaba dünya")).toBe("merhaba dünya")
  })
  it("reports the kind", () => {
    expect(scanText("seni öldüreceğim").kinds).toContain("THREAT")
    expect(scanText("gerizekalı").kinds).toContain("INSULT")
    expect(scanText("fuck").kinds).toContain("PROFANITY")
    expect(scanText("nigger").kinds).toContain("HATE")
    expect(scanText("bahis sitesi").kinds).toContain("SPAM")
  })
  it("handles empty and weird input", () => {
    expect(scanText("").clean).toBe(true)
    expect(scanText("   ").clean).toBe(true)
    expect(scanText("​s​i​k​t​i​r").clean).toBe(false) // zero-width characters
    expect(scanText("1234567890").clean).toBe(true)
    expect(scanText("!!! ??? ...").clean).toBe(true)
  })
})

describe("contact details and links", () => {
  const flagged: [string, string][] = [
    ["https://example.com/abc", "LINK"], ["www.site.com", "LINK"], ["bak bu.com güzel", "LINK"], ["instagram.com/hoca", "LINK"],
    ["mail at test@example.com", "EMAIL"], ["test (at) example (dot) com", "EMAIL"],
    ["05321234567", "PHONE"], ["0532 123 45 67", "PHONE"], ["+90 532 123 45 67", "PHONE"], ["532-123-45-67", "PHONE"],
    ["TR33 0006 1005 1978 6457 8413 26", "IBAN"], ["tr330006100519786457841326", "IBAN"],
    ["whatsapp'tan yaz", "HANDLE"], ["bana telegram yaz", "HANDLE"], ["dm at", "HANDLE"], ["özelden yaz", "HANDLE"],
  ]
  for (const [t, kind] of flagged) it(`flags ${kind}: ${t}`, () => expect(findContact(t)).toBe(kind))
  const fine = ["Ders saat 18:30'da", "2 saat 30 dakika", "4-7-8 nefesi", "1080p 60 fps", "haftada 3 gün", "ücret 25 dolar", "Merhaba!", "nefes 4 saniye al 6 saniye ver", "yüzde 15 komisyon", "2024 yılında", "1.5 saat"]
  for (const t of fine) it(`does not flag: ${t}`, () => expect(findContact(t)).toBeNull())
})

describe("spam shapes", () => {
  it("detects shouting, character floods and repetition", () => {
    expect(findSpamShape("BU DERS ÇOK KÖTÜYDÜ HERKES GÖRSÜN BUNU")).toBe("SHOUTING")
    expect(findSpamShape("harikaaaaaaaaaaaaaaa")).toBe("REPEATED_CHARS")
    expect(findSpamShape("al al al al al al al al")).toBe("REPEATED_WORDS")
    expect(findSpamShape("🙏🙏🙏🙏🙏🙏🙏🙏🙏🙏🙏🙏🙏🙏")).toBe("EMOJI_FLOOD")
  })
  it("leaves normal enthusiasm alone", () => {
    expect(findSpamShape("HARİKA!")).toBeNull()
    expect(findSpamShape("Çok güzel bir ders oldu, teşekkürler 🙏")).toBeNull()
    expect(findSpamShape("Hatha ve YIN dersleri")).toBeNull()
  })
})
