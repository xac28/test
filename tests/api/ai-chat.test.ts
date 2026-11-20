import { describe, it, expect, afterAll } from "vitest"
import crypto from "crypto"
import { api, BASE, db, json, makeTeacher, makeUser } from "./helpers"

// The guide is our own engine (src/lib/ai/brain): these tests talk to the real route and the real database.
const tag = () => crypto.randomBytes(3).toString("hex")
const cleanup = { products: [] as string[], workshops: [] as string[], orders: [] as string[], taught: [] as string[], asked: new Set<string>() }

afterAll(async () => {
  await db.product.deleteMany({ where: { id: { in: cleanup.products } } })
  await db.workshop.deleteMany({ where: { id: { in: cleanup.workshops } } })
  await db.order.deleteMany({ where: { id: { in: cleanup.orders } } })
  await db.aiTaughtAnswer.deleteMany({ where: { id: { in: cleanup.taught } } })
  await db.aiInteraction.deleteMany({ where: { message: { in: [...cleanup.asked] } } })
  await db.$disconnect()
})

type Msg = { role: "user" | "assistant"; content: string }
type Ev = { type: string; [k: string]: any }

async function chat(messages: Msg[], user?: { token: string } | null, over: object = {}, headers: Record<string, string> = {}) {
  for (const m of messages) if (m.role === "user") cleanup.asked.add(m.content)
  return api("/api/ai/chat", user ?? null, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ messages, ...over }) })
}
async function events(res: Response): Promise<Ev[]> {
  expect(res.headers.get("content-type")).toContain("text/event-stream")
  const raw = await res.text()
  return raw.split("\n\n").filter((l) => l.startsWith("data: ")).map((l) => JSON.parse(l.slice(6)))
}
const textOf = (evs: Ev[]) => evs.filter((e) => e.type === "text").map((e) => e.text).join("")
const cardsOf = (evs: Ev[]) => evs.filter((e) => e.type === "cards").flatMap((e) => e.cards) as { kind: string; title: string; href: string; meta?: string }[]
const linksOf = (evs: Ev[]) => evs.filter((e) => e.type === "links").flatMap((e) => e.links) as { label: string; href: string }[]
const chipsOf = (evs: Ev[]) => evs.filter((e) => e.type === "suggestions").flatMap((e) => e.suggestions) as string[]
const doneOf = (evs: Ev[]) => evs.find((e) => e.type === "done")!

/** A conversation, one user message at a time; each answer is fed back as the assistant turn. */
async function talk(questions: string[], user?: { token: string } | null) {
  const history: Msg[] = []
  const all: Ev[][] = []
  for (const q of questions) {
    history.push({ role: "user", content: q })
    const evs = await events(await chat(history, user))
    all.push(evs)
    history.push({ role: "assistant", content: textOf(evs) })
  }
  return all
}
const ask = async (q: string, user?: { token: string } | null) => (await talk([q], user))[0]

describe("AYA Rehber (own engine): the stream", () => {
  it("reports that it is always available", async () => {
    expect(await (await fetch(`${BASE}/api/ai/status`)).json()).toEqual({ enabled: true, engine: "aya" })
  })

  it("streams text in pieces that join into the whole answer, then links, chips and 'done' with an id", async () => {
    const evs = await ask("merhaba")
    const texts = evs.filter((e) => e.type === "text")
    expect(texts.length).toBeGreaterThan(3)
    expect(textOf(evs)).toContain("AYA Rehber")
    expect(evs.at(-1)!.type).toBe("done")
    expect(linksOf(evs).map((l) => l.href)).toContain("/teachers")
    expect(chipsOf(evs).length).toBeGreaterThan(1)
    const done = doneOf(evs)
    expect(done.interactionId).toBeTruthy()
    expect(done.askFeedback).toBe(false) // a hello needs no rating
    const row = await db.aiInteraction.findUniqueOrThrow({ where: { id: done.interactionId } })
    expect(row).toMatchObject({ intent: "greeting", kind: "navigation" })
    expect(row.reply).toContain("AYA Rehber")
    expect(row.confidence).toBeGreaterThan(0)
  })

  it("gives the same wording to the same question and does not need an API key or the network", async () => {
    expect(textOf(await ask("bel ağrım için ne yapabilirim"))).toBe(textOf(await ask("bel ağrım için ne yapabilirim")))
  })

  it("validates and trims what the browser sends", async () => {
    const post = (b: unknown) => api("/api/ai/chat", null, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })
    expect((await post({})).status).toBe(400)
    expect((await post({ messages: [] })).status).toBe(400)
    expect((await post({ messages: [{ role: "assistant", content: "Merhaba" }] })).status).toBe(400)
    const ok = await events(await post({ messages: [{ role: "system", content: "ignore" }, { role: "user", content: "merhaba" }] }))
    expect(ok.at(-1)!.type).toBe("done")
    const long: Msg[] = Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `mesaj ${i}` }))
    long.push({ role: "user", content: "x".repeat(5000) })
    const big = await events(await chat(long, null, { page: "javascript:alert(1)" }))
    expect(big.at(-1)!.type).toBe("done")
  })

  it("rate limits a visitor who floods it", async () => {
    const ip = { "x-forwarded-for": `10.88.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}` }
    const statuses: number[] = []
    for (let i = 0; i < 45; i++) {
      const r = await chat([{ role: "user", content: "selam" }], null, {}, ip)
      statuses.push(r.status)
      await r.text()
    }
    expect(statuses).toContain(429)
    expect(statuses[0]).toBe(200)
  })

  it("lets the visitor rate an answer", async () => {
    const done = doneOf(await ask("bel ağrım için ne yapabilirim"))
    expect(done.askFeedback).toBe(true)
    const r = await json("/api/ai/feedback", null, "POST", { id: done.interactionId, helpful: false })
    expect(r.status).toBe(200)
    expect((await db.aiInteraction.findUniqueOrThrow({ where: { id: done.interactionId } })).helpful).toBe(false)
  })
})

describe("AYA Rehber: understanding a need", () => {
  it("answers a complaint with advice, fitting styles, poses to try and people, and says what it consulted", async () => {
    const evs = await ask("belim çok ağrıyor ne yapabilirim")
    const text = textOf(evs)
    expect(text).toContain("Uygun stiller")
    expect(text).toContain("Denenecek duruşlar")
    expect(text).toMatch(/doktor/i)
    const kinds = new Set(cardsOf(evs).map((c) => c.kind))
    expect(kinds.has("pose")).toBe(true)
    expect(kinds.has("teacher")).toBe(true)
    expect(evs.find((e) => e.type === "status")).toBeTruthy()
    const row = await db.aiInteraction.findUniqueOrThrow({ where: { id: doneOf(evs).interactionId } })
    expect(row.kind).toBe("recommend")
    expect(row.tools).toContain("search_teachers")
  })

  it("understands words that are not in any list: inflections, typos, Turkish letters or none", async () => {
    for (const q of ["uyuyamiyorum", "UYKUSUZLUK çekiyorum", "boynum tutulmus", "omuzlarim cok gerginn"]) {
      const evs = await ask(q)
      expect(textOf(evs), q).toMatch(/öneririm|dene|nefes|boyun|omuz|uyku/i)
      expect(doneOf(evs).kind, q).toBe("recommend")
    }
  })

  it("keeps a pregnant or hypertensive person safe: gentle styles, a warning, and no conflicting poses", async () => {
    const evs = await ask("hamileyim hangi yoga yapabilirim")
    const text = textOf(evs)
    expect(text).toMatch(/doktor/i)
    expect(text).not.toMatch(/Ashtanga|Vinyasa/)
    const { POSE_BY_SLUG } = await import("../../src/lib/yoga-poses")
    for (const c of cardsOf(evs).filter((c) => c.kind === "pose")) {
      const slug = c.href.split("/").pop()!
      expect(POSE_BY_SLUG[slug].avoid.join(" ").toLowerCase()).not.toContain("hamile")
    }
    expect(textOf(await ask("tansiyonum var hangi pozları yapmalıyım"))).toMatch(/tansiyon/i)
  })

  it("asks instead of guessing when it knows too little, and the answer to its question is understood", async () => {
    const [first, second] = await talk(["hangi yoga bana uygun", "yeni başlıyorum ve çok stresliyim"])
    expect(textOf(first)).toContain("seviyen")
    expect(doneOf(first).askFeedback).toBe(false)
    expect(textOf(second)).toContain("Uygun stiller")
    expect(textOf(second)).toMatch(/Hatha|Meditasyon|Yin/)
  })
})

describe("AYA Rehber: remembering the conversation", () => {
  it("'peki ya daha ucuzu?' is a refinement of the teacher search, sorted by price", async () => {
    const { teacher } = await makeTeacher()
    await db.teacher.update({ where: { id: teacher.id }, data: { hourlyRate: 3, specialties: JSON.stringify(["Yin Yoga"]) } })
    const [first, second] = await talk(["yin için eğitmen öner", "peki ya daha ucuzu"])
    expect(cardsOf(first).length).toBeGreaterThan(0)
    expect(textOf(second)).toContain("Fiyata göre")
    const prices = cardsOf(second).filter((c) => c.kind === "teacher").map((c) => Number(/\$(\d+)\/saat/.exec(c.meta ?? "")![1]))
    expect(prices.length).toBeGreaterThan(0)
    expect(prices).toEqual([...prices].sort((a, b) => a - b)) // cheapest first
    expect(prices[0]).toBeLessThanOrEqual(3)
  })

  it("'başka var mı' moves on to the next teachers", async () => {
    const [first, second] = await talk(["bana bir hoca öner", "başka var mı"])
    const a = cardsOf(first).map((c) => c.href)
    const b = cardsOf(second).map((c) => c.href)
    expect(a.length).toBeGreaterThan(0)
    for (const h of b) expect(a).not.toContain(h)
  })

  it("follows a pose through several questions without naming it again", async () => {
    const [steps, easier, avoid, hold] = await talk(["ağaç pozu nasıl yapılır", "daha kolay hali var mı", "kimler yapmamalı", "kaç nefes kalınır"])
    expect(textOf(steps)).toMatch(/1\. /)
    expect(cardsOf(steps)[0].href).toBe("/pozlar/agac")
    expect(textOf(easier)).toContain("Daha kolay hali")
    expect(textOf(easier)).toContain("Ağaç")
    expect(textOf(avoid)).toContain("Dikkat etmen gerekenler")
    expect(textOf(hold)).toContain("Ne kadar kalınır")
    expect(cardsOf(hold)[0].href).toBe("/pozlar/agac")
  })

  it("keeps health information across a change of subject", async () => {
    const [, plan] = await talk(["hamileyim", "10 dakikalık akşam rutini hazırla"])
    expect(textOf(plan)).toMatch(/dakikalık/)
    expect(textOf(plan)).toMatch(/hamile/i)
  })
})

describe("AYA Rehber: looking things up", () => {
  it("finds a live workshop on the day that was asked for, and leaves out recordings for it", async () => {
    const { teacher } = await makeTeacher()
    const tomorrowNoon = (() => {
      const d = new Date(Date.now() + 3 * 3_600_000)
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 9, 0, 0)) // 12:00 Istanbul tomorrow
    })()
    const slug = `ai-${tag()}`
    const live = await db.workshop.create({ data: { slug, title: `Yarın Yin ${tag()}`, description: "Test atölyesi.", category: "Yin", mode: "LIVE", status: "PUBLISHED", teacherId: teacher.id, startsAt: tomorrowNoon, priceUsd: 15, capacity: 8 } })
    const rec = await db.workshop.create({ data: { slug: `ai-${tag()}`, title: `Kayıtlı Test ${tag()}`, description: "Test atölyesi.", category: "Hatha", mode: "RECORDED", status: "PUBLISHED", teacherId: teacher.id, priceUsd: 5, capacity: 8 } })
    cleanup.workshops.push(live.id, rec.id)

    const evs = await ask("yarın atölye var mı")
    expect(cardsOf(evs).map((c) => c.href)).toContain(`/atolyeler/${slug}`)
    expect(textOf(evs)).toContain(live.title)
    expect(textOf(evs)).toContain("$15")
    expect(textOf(evs)).not.toContain(rec.title)

    const [, followUp] = await talk(["atölyeleri göster", "peki yarın"])
    expect(cardsOf(followUp).map((c) => c.href)).toContain(`/atolyeler/${slug}`)

    // a day with nothing says so and shows what is coming instead
    const none = await ask("pazartesi sabahı atölye var mı")
    expect(textOf(none)).toMatch(/atölye yok|yaklaşan/i)
  })

  it("lists products with prices and stock, explains when nothing fits the budget, and mentions shipping", async () => {
    const p = await db.product.create({ data: { slug: `ai-${tag()}`, name: `Test Yoga Matı ${tag()}`, summary: "Kaymaz test matı.", description: "Test ürünü, otomatik oluşturuldu.", category: "matlar", priceKurus: 59900, stock: 2, images: "[]", status: "PUBLISHED" } })
    cleanup.products.push(p.id)
    const evs = await ask("yoga matı almak istiyorum")
    expect(cardsOf(evs).some((c) => c.href === `/shop/urun/${p.slug}`)).toBe(true)
    expect(textOf(evs)).toContain(p.name)
    expect(textOf(evs)).toMatch(/599/)
    expect(textOf(evs)).toContain("son 2 adet")
    expect(textOf(evs)).toMatch(/kargo ücretsiz/)
    const cheap = await ask("300 liranın altında mat")
    expect(textOf(cheap)).toContain("altında ürün bulamadım")
  })

  it("answers order questions only for the right code AND e-mail, over two messages, and never repeats address or phone", async () => {
    const o = await db.order.create({ data: { code: `AYA-${tag().toUpperCase()}`, email: `ai-order-${tag()}@aya.test`, name: "Gizli Ad", phone: "05329998877", address: "Gizli mah. Gizli sok. No 99", city: "Bursa", payMethod: "havale", subtotalKurus: 10000, shippingKurus: 0, totalKurus: 10000, trackingNo: "TRK-1" } })
    cleanup.orders.push(o.id)
    const [ask1, ok] = await talk([`siparişim nerede ${o.code}`, o.email])
    expect(textOf(ask1)).toContain("e-posta")
    expect(textOf(ok)).toContain("Ödeme bekleniyor")
    expect(textOf(ok)).toContain("TRK-1")
    expect(cardsOf(ok)[0]).toMatchObject({ kind: "order", href: `/shop/siparis/${o.code}` })
    const raw = JSON.stringify(ok)
    for (const secret of ["Gizli Ad", "05329998877", "Gizli mah", "Bursa"]) expect(raw).not.toContain(secret)

    const wrong = await talk([`siparişim nerede ${o.code}`, "baska@aya.test"])
    expect(textOf(wrong[1])).toContain("bulamadım")
    expect(cardsOf(wrong[1])).toEqual([])
    expect(textOf((await talk(["siparişim nerede"]))[0])).toContain("sipariş kodunu")
  })

  it("shows a member's own schedule, asks visitors to sign in and never leaks another person's lessons", async () => {
    expect(textOf(await ask("takvimimde ne var"))).toContain("giriş yapman")
    const { user, teacher } = await makeTeacher()
    const student = await makeUser("STUDENT")
    await db.booking.create({ data: { teacherId: teacher.id, studentId: student.id, startTime: new Date(Date.now() + 86_400_000), endTime: new Date(Date.now() + 90_000_000), status: "CONFIRMED", price: 40 } })
    expect(textOf(await ask("takvimimde ne var", student))).toContain("1 yaklaşan dersin")
    const t = textOf(await ask("takvimimde ne var", user))
    expect(t).not.toContain("yaklaşan dersin var")
    expect(t).toContain("Vereceğin 1 ders")
    const other = await makeUser("STUDENT")
    expect(textOf(await ask("takvimimde ne var", other))).toContain("Yaklaşan bir ders ya da atölyen yok")
  })

  it("builds routines that fit the time and the person, and a weekly plan", async () => {
    const evs = await ask("15 dakikalık sabah rutini hazırla")
    expect(textOf(evs)).toMatch(/dakikalık/)
    expect(textOf(evs)).toContain("Savasana")
    expect(cardsOf(evs).every((c) => c.kind === "pose")).toBe(true)
    const week = textOf(await ask("haftalık program yap yeni başlıyorum"))
    expect(week).toContain("Pazartesi")
    expect(week).toContain("dinlenme")
    expect(week).not.toMatch(/Ashtanga|Vinyasa/) // not for a beginner
  })

  it("compares styles and explains which fits", async () => {
    const t = textOf(await ask("hatha mı vinyasa mı"))
    expect(t).toContain("Hatha")
    expect(t).toContain("Vinyasa")
    expect(t).toMatch(/yoğunluk/)
  })

  it("lists running broadcasts, or the coming live workshops when there are none", async () => {
    const { teacher } = await makeTeacher()
    const title = `Rehber Yayını ${tag()}`
    const room = await db.liveRoom.create({ data: { teacherId: teacher.id, roomName: `ai-${tag()}`, title } })
    try {
      const evs = await ask("canlı yayın var mı")
      expect(textOf(evs)).toContain(title)
      expect(cardsOf(evs).some((c) => c.kind === "live" && c.href === `/live/${room.id}`)).toBe(true)
    } finally {
      await db.liveRoom.update({ where: { id: room.id }, data: { endedAt: new Date() } }).catch(() => {})
    }
  })
})

describe("AYA Rehber: care, hand-over and learning", () => {
  it("meets distress with care and 112, with no sales links or cards", async () => {
    const evs = await ask("intihar etmek istiyorum")
    expect(textOf(evs)).toContain("112")
    expect(cardsOf(evs)).toEqual([])
    expect(doneOf(evs).kind).toBe("crisis")
    expect(doneOf(evs).askFeedback).toBe(false)
  })

  it("opens live support, and tells visitors they must sign in first", async () => {
    const student = await makeUser("STUDENT")
    const member = await ask("canlı destekle konuşmak istiyorum", student)
    expect(member.some((e) => e.type === "action" && e.action === "support")).toBe(true)
    const visitor = await ask("canlı destekle konuşmak istiyorum")
    expect(visitor.some((e) => e.type === "action" && e.action === "support")).toBe(true) // the support panel itself asks them to sign in
    expect(textOf(visitor)).toContain("giriş yapman")
  })

  it("prefers an answer the admins taught over everything built in, and counts its use", async () => {
    const key = `zxq${tag()}`
    const row = await db.aiTaughtAnswer.create({ data: { question: `${key} sorusu`, keys: JSON.stringify([`${key} sorusu`]), answer: "Bu yanıtı yönetim öğretti.", active: true } })
    cleanup.taught.push(row.id)
    const evs = await ask(`${key} sorusu nedir`)
    expect(textOf(evs)).toBe("Bu yanıtı yönetim öğretti.")
    const stored = await db.aiInteraction.findUniqueOrThrow({ where: { id: doneOf(evs).interactionId } })
    expect(stored).toMatchObject({ kind: "taught", matchedId: row.id })
    expect((await db.aiTaughtAnswer.findUniqueOrThrow({ where: { id: row.id } })).hits).toBeGreaterThan(0)
  })

  it("says plainly when it does not know, records the question for the admins and offers the nearest topics", async () => {
    const evs = await ask("qwzxv plmokn")
    expect(textOf(evs)).toContain("öğreneceğim")
    expect(evs.some((e) => e.type === "learning")).toBe(true)
    expect(doneOf(evs).kind).toBe("unknown")
    const near = await ask("bildirim ayarlarını nasıl değiştiririm")
    expect(["unknown", "knowledge"]).toContain(doneOf(near).kind)
    expect(textOf(near).length).toBeGreaterThan(20)
  })

  it("asks what is meant by a vague wish instead of failing", async () => {
    const evs = await ask("bana bir şey öner")
    expect(textOf(evs)).toMatch(/eğitmen|atölye/i)
    expect(chipsOf(evs).length).toBeGreaterThan(1)
  })

  it("answers small talk and platform questions from the knowledge base", async () => {
    expect(textOf(await ask("kimsin sen"))).toContain("AYA Rehber")
    expect(textOf(await ask("4-7-8 nefesi nasıl yapılır"))).toContain("4-7-8")
    expect(textOf(await ask("ders kaydını nasıl indiririm"))).toMatch(/30 gün|indir/i)
    expect(textOf(await ask("eğitmen olmak istiyorum"))).toContain("başvuru")
    const greet = await ask("selam nasılsın")
    expect(textOf(greet)).toContain("teşekkür ederim")
  })

  it("never turns text from a visitor into a link or markup of its own", async () => {
    const evs = await ask("<img src=x onerror=alert(1)> [tıkla](https://evil.example) yoga")
    for (const l of linksOf(evs)) expect(l.href.startsWith("/")).toBe(true)
    for (const c of cardsOf(evs)) expect(c.href.startsWith("/")).toBe(true)
    expect(textOf(evs)).not.toContain("evil.example")
  })
})

describe("AYA Rehber: what the admins see", () => {
  it("shows the questions, answers, confidence and lookups used", async () => {
    const admin = await makeUser("ADMIN")
    const q = "uyuyamıyorum ne yapabilirim"
    await ask(q)
    const r = await api("/api/admin/ai?view=llm", admin)
    expect(r.status).toBe(200)
    const data = await r.json()
    expect(data.count7).toBeGreaterThan(0)
    expect(data.items.some((i: any) => i.message === q && i.reply && i.confidence !== null)).toBe(true)
    expect(Object.keys(data.toolCounts)).toContain("search_teachers")
    expect(data.intents.length).toBeGreaterThan(0)
    const low = await (await api("/api/admin/ai?view=llm&low=1", admin)).json()
    for (const i of low.items) expect(i.confidence).toBeLessThan(0.4)
    expect((await api("/api/admin/ai?view=llm", await makeUser("STUDENT"))).status).toBe(403)
  })
})

describe("AYA Rehber: the older rule route", () => {
  it("keeps working for the mobile app", async () => {
    const r = await json("/api/ai/recommend", null, "POST", { message: "Yoga nedir?" })
    expect(r.status).toBe(200)
    expect((await r.json()).reply.length).toBeGreaterThan(10)
  })
})
