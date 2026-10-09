import { describe, it, expect, afterAll } from "vitest"
import { api, json, makeTeacher, makeUser, db } from "./helpers"

const HOUR = 3_600_000
const created = { workshops: [] as string[], products: [] as string[], articles: [] as string[], emails: [] as string[], orders: [] as string[] }
afterAll(async () => {
  await db.workshop.deleteMany({ where: { id: { in: created.workshops } } })
  await db.order.deleteMany({ where: { id: { in: created.orders } } })
  await db.product.deleteMany({ where: { id: { in: created.products } } })
  await db.article.deleteMany({ where: { id: { in: created.articles } } })
  await db.newsletterSubscriber.deleteMany({ where: { email: { in: created.emails } } })
  await db.newsletterCampaign.deleteMany({ where: { OR: [{ refId: { in: [...created.products, ...created.articles] } }, { subject: { startsWith: "AYA bu hafta" } }] } })
  await db.$disconnect()
})

const cron = (path: string, secret: string | null = process.env.CRON_SECRET!) => api(path, null, { method: "POST", headers: secret ? { authorization: `Bearer ${secret}` } : {} })
const notes = (userId: string, title: string) => db.notification.count({ where: { userId, title: { startsWith: title } } })
const rnd = () => Math.random().toString(36).slice(2, 7)

async function booking(teacherId: string, studentId: string, startsInMs: number, status: "CONFIRMED" | "COMPLETED" | "CANCELLED" | "PENDING" = "CONFIRMED") {
  const start = new Date(Date.now() + startsInMs)
  return db.booking.create({ data: { teacherId, studentId, startTime: start, endTime: new Date(start.getTime() + HOUR), status, price: 40 } })
}

describe("cron protection", () => {
  it("refuses callers without the secret", async () => {
    for (const path of ["/api/cron/reminders", "/api/cron/digests"]) {
      expect((await cron(path, null)).status).toBe(401)
      expect((await cron(path, "wrong")).status).toBe(401)
    }
  })
})

describe("lesson and workshop reminders", () => {
  it("reminds 24 h and 1 h ahead, only confirmed lessons, and never twice", async () => {
    const { user: tUser, teacher } = await makeTeacher()
    const student = await makeUser("STUDENT")
    const day = await booking(teacher.id, student.id, 20 * HOUR)
    const soon = await booking(teacher.id, student.id, 30 * 60_000)
    const far = await booking(teacher.id, student.id, 40 * HOUR)
    const cancelled = await booking(teacher.id, student.id, 20 * HOUR, "CANCELLED")
    const unpaid = await booking(teacher.id, student.id, 20 * HOUR, "PENDING")

    const res = await cron("/api/cron/reminders")
    expect(res.status).toBe(200)
    const out = await res.json()
    expect(out.lessons24).toBeGreaterThanOrEqual(1)
    expect(out.lessons1h).toBeGreaterThanOrEqual(1)

    const get = (id: string) => db.booking.findUniqueOrThrow({ where: { id } })
    const [d, s, f, c, u] = await Promise.all([get(day.id), get(soon.id), get(far.id), get(cancelled.id), get(unpaid.id)])
    expect(d.reminder24At).toBeTruthy()
    expect(d.reminder1hAt).toBeNull()
    expect(s.reminder1hAt).toBeTruthy()
    expect(s.reminder24At).toBeNull() // starting within the hour: only the short reminder
    for (const x of [f, c, u]) { expect(x.reminder24At).toBeNull(); expect(x.reminder1hAt).toBeNull() }

    expect(await notes(student.id, "Dersin yarın")).toBe(1)
    expect(await notes(student.id, "Dersin 1 saat içinde")).toBe(1)
    expect(await notes(tUser.id, "Dersin yarın")).toBe(1)
    const n = await db.notification.findFirstOrThrow({ where: { userId: student.id, title: { startsWith: "Dersin yarın" } } })
    expect(n.href).toBe("/dashboard")

    await cron("/api/cron/reminders") // a second run changes nothing
    expect(await notes(student.id, "Dersin yarın")).toBe(1)
    expect(await notes(student.id, "Dersin 1 saat içinde")).toBe(1)
    expect((await get(day.id)).reminder24At!.getTime()).toBe(d.reminder24At!.getTime())
  })

  it("two runs at the same moment still send one reminder", async () => {
    const { teacher } = await makeTeacher()
    const student = await makeUser("STUDENT")
    await booking(teacher.id, student.id, 10 * HOUR)
    await Promise.all([cron("/api/cron/reminders"), cron("/api/cron/reminders"), cron("/api/cron/reminders")])
    expect(await notes(student.id, "Dersin yarın")).toBe(1)
  })

  it("reminds confirmed workshop participants of a live workshop, not reserved, cancelled or recorded ones", async () => {
    const { teacher } = await makeTeacher()
    const [a, b, c, d] = await Promise.all([makeUser("STUDENT"), makeUser("STUDENT"), makeUser("STUDENT"), makeUser("STUDENT")])
    const mk = (mode: "LIVE" | "RECORDED", startsAt: Date | null) => db.workshop.create({ data: { slug: `auto-${rnd()}`, title: `Hatırlatma atölyesi ${rnd()}`, description: "Otomasyon testi için oluşturuldu.", category: "Yin", mode, status: "PUBLISHED", teacherId: teacher.id, startsAt, priceUsd: 10, capacity: 10 } })
    const live = await mk("LIVE", new Date(Date.now() + 20 * HOUR))
    const rec = await mk("RECORDED", null)
    created.workshops.push(live.id, rec.id)
    await db.workshopEnrollment.createMany({ data: [
      { workshopId: live.id, userId: a.id, status: "CONFIRMED" }, { workshopId: live.id, userId: b.id, status: "RESERVED" },
      { workshopId: live.id, userId: c.id, status: "CANCELLED" }, { workshopId: rec.id, userId: d.id, status: "CONFIRMED" },
    ] })
    const out = await (await cron("/api/cron/reminders")).json()
    expect(out.workshops24).toBeGreaterThanOrEqual(1)
    expect(await notes(a.id, "Atölyen yarın")).toBe(1)
    const n = await db.notification.findFirstOrThrow({ where: { userId: a.id, title: { startsWith: "Atölyen" } } })
    expect(n.href).toBe(`/atolyeler/${live.slug}`)
    expect(n.body).toContain(live.title)
    for (const u of [b, c, d]) expect(await notes(u.id, "Atölyen")).toBe(0)
    await cron("/api/cron/reminders")
    expect(await notes(a.id, "Atölyen yarın")).toBe(1)
  })

  it("asks for a review once, 2 hours to 7 days after a completed lesson, only without a review", async () => {
    const { teacher } = await makeTeacher()
    const student = await makeUser("STUDENT")
    const ready = await booking(teacher.id, student.id, -4 * HOUR, "COMPLETED") // ended 3 h ago
    const tooSoon = await booking(teacher.id, student.id, -90 * 60_000, "COMPLETED") // ended 30 min ago
    const tooOld = await booking(teacher.id, student.id, -9 * 24 * HOUR, "COMPLETED")
    const reviewed = await booking(teacher.id, student.id, -5 * HOUR, "COMPLETED")
    await db.review.create({ data: { bookingId: reviewed.id, rating: 5, comment: "Harika" } })

    const out = await (await cron("/api/cron/reminders")).json()
    expect(out.reviewAsks).toBeGreaterThanOrEqual(1)
    const get = (id: string) => db.booking.findUniqueOrThrow({ where: { id } })
    expect((await get(ready.id)).reviewAskedAt).toBeTruthy()
    for (const b of [tooSoon, tooOld, reviewed]) expect((await get(b.id)).reviewAskedAt).toBeNull()
    expect(await notes(student.id, "Dersin nasıldı")).toBe(1)
    await cron("/api/cron/reminders")
    expect(await notes(student.id, "Dersin nasıldı")).toBe(1)
  })
})

describe("daily admin summary and weekly newsletter digest", () => {
  it("lists what waits for a decision and notifies the admins; a quiet day sends nothing extra", async () => {
    const admin = await makeUser("ADMIN")
    const p = await db.product.create({ data: { slug: `auto-${rnd()}`, name: `Özet ürünü ${rnd()}`, summary: "Özet testi için ürün.", description: "Otomasyon testi için oluşturuldu ve silinecek.", category: "wellness", priceKurus: 10000, stock: 1, images: "[]", status: "PUBLISHED" } })
    created.products.push(p.id)
    const o = await db.order.create({ data: { code: `AYA-Z${rnd().toUpperCase().replace(/[^A-Z0-9]/g, "X").padEnd(5, "X")}`, email: "digest@aya.test", name: "Özet", phone: "05320000000", address: "Test mah. Test sok. No 1", city: "Bursa", payMethod: "havale", subtotalKurus: 10000, shippingKurus: 0, totalKurus: 10000 } })
    created.orders.push(o.id)
    const res = await cron("/api/cron/digests?weekly=0")
    expect(res.status).toBe(200)
    const out = await res.json()
    expect(out.newsletter).toBeNull()
    const labels = out.admin.items.map((i: any) => i.label)
    expect(labels).toContain("Açık sipariş (ödeme/hazırlık)")
    expect(labels).toContain("Stoğu azalan ürün")
    expect(out.admin.items.find((i: any) => i.label.startsWith("Açık sipariş")).href).toBe("/admin?tab=orders")
    expect(out.admin.total).toBeGreaterThan(0)
    expect(await notes(admin.id, "Günlük özet")).toBeGreaterThanOrEqual(1)
    const student = await makeUser("STUDENT")
    expect(await notes(student.id, "Günlük özet")).toBe(0) // only admins
  })

  it("mails what is new once a week and records it; not twice in the same week, not when nothing is new", async () => {
    const admin = await makeUser("ADMIN")
    const smtp = (await (await api("/api/admin/newsletter", admin)).json()).smtp
    if (smtp) return // with real SMTP settings this would send mail
    const week = (await import("../../src/lib/automation")).isoWeek(new Date())
    await db.newsletterCampaign.deleteMany({ where: { kind: "digest", refId: `digest-${week}` } })

    const a = await db.article.create({ data: { slug: `auto-${rnd()}`, title: `Haftalık özet yazısı ${rnd()}`, excerpt: "Haftalık özet testi için yazı, otomatik oluşturuldu.", body: "## Test\n\n" + "Haftalık özet testi. ".repeat(10), category: "Hareket", status: "PUBLISHED", publishedAt: new Date(), authorId: admin.id } })
    created.articles.push(a.id)
    const first = await (await cron("/api/cron/digests?weekly=1")).json()
    expect(first.newsletter).toMatchObject({ sent: false, reason: "no-smtp", refId: `digest-${week}` })
    const row = await db.newsletterCampaign.findFirstOrThrow({ where: { kind: "digest", refId: `digest-${week}` } })
    expect(row.body).toContain(a.title)
    expect(row.body).toContain(`/icerikler/${a.slug}`)
    expect(row.subject).toMatch(/^AYA bu hafta: \d+ yeni içerik$/)
    const second = await (await cron("/api/cron/digests?weekly=1")).json()
    expect(second.newsletter).toMatchObject({ sent: false, reason: "already-sent" })
    expect(await db.newsletterCampaign.count({ where: { kind: "digest", refId: `digest-${week}` } })).toBe(1)
  })

  it("isoWeek labels weeks the ISO way", async () => {
    const { isoWeek } = await import("../../src/lib/automation")
    expect(isoWeek(new Date("2026-01-01T12:00:00Z"))).toBe("2026-W01")
    expect(isoWeek(new Date("2026-12-31T12:00:00Z"))).toBe("2026-W53")
    expect(isoWeek(new Date("2025-12-29T12:00:00Z"))).toBe("2026-W01")
    expect(isoWeek(new Date("2026-10-12T00:00:00Z"))).toBe("2026-W42")
  })
})

describe("back in stock", () => {
  async function soldOut(admin: { token: string }, stock = 0) {
    const r = await json("/api/admin/products", admin, "POST", { name: `Stok ürünü ${rnd()}`, summary: "Stok bildirimi testi için ürün.", description: "Otomasyon testi için oluşturuldu ve silinecek.", category: "matlar", priceTL: 100, stock, images: [], status: "PUBLISHED" })
    const p = (await r.json()).product
    created.products.push(p.id)
    return p
  }
  async function waiter(slug: string) {
    const email = `waiting-${rnd()}@aya.test`
    created.emails.push(email)
    await json("/api/newsletter", null, "POST", { email, source: `shop:${slug}` })
    return email
  }

  it("tells the people who asked, once, when an admin refills a sold-out product", async () => {
    const admin = await makeUser("ADMIN")
    const smtp = (await (await api("/api/admin/newsletter", admin)).json()).smtp
    if (smtp) return
    const p = await soldOut(admin)
    const who = await waiter(p.slug)
    const other = await waiter("baska-urun")
    const left = await waiter(p.slug)
    await db.newsletterSubscriber.update({ where: { email: left.toLowerCase() }, data: { unsubscribedAt: new Date() } })

    expect((await json(`/api/admin/products/${p.id}`, admin, "PATCH", { name: `${p.name} (yeni)` })).status).toBe(200) // an edit alone is not a restock
    expect(await db.newsletterCampaign.count({ where: { refId: p.id, kind: "restock" } })).toBe(0)

    expect((await json(`/api/admin/products/${p.id}`, admin, "PATCH", { stock: 5 })).status).toBe(200)
    expect((await db.newsletterSubscriber.findUniqueOrThrow({ where: { email: who.toLowerCase() } })).source).toBe(`shop:${p.slug}:notified`)
    expect((await db.newsletterSubscriber.findUniqueOrThrow({ where: { email: other.toLowerCase() } })).source).toBe("shop:baska-urun")
    expect((await db.newsletterSubscriber.findUniqueOrThrow({ where: { email: left.toLowerCase() } })).source).toBe(`shop:${p.slug}`) // unsubscribed: untouched
    const c = await db.newsletterCampaign.findMany({ where: { refId: p.id, kind: "restock" } })
    expect(c).toHaveLength(1)
    expect(c[0].subject).toContain(p.name)

    await json(`/api/admin/products/${p.id}`, admin, "PATCH", { stock: 0 })
    await json(`/api/admin/products/${p.id}`, admin, "PATCH", { stock: 8 })
    expect(await db.newsletterCampaign.count({ where: { refId: p.id, kind: "restock" } })).toBe(1) // nobody is waiting any more
  })

  it("also fires when a cancelled order returns the last item to the shelf", async () => {
    const admin = await makeUser("ADMIN")
    const smtp = (await (await api("/api/admin/newsletter", admin)).json()).smtp
    if (smtp) return
    const p = await soldOut(admin, 1)
    const email = `cart-${rnd()}@aya.test`
    created.emails.push(email)
    const placed = await json("/api/shop/orders", null, "POST", { name: "Stok Testi", email, phone: "05321112233", address: "Test mah. Test sok. No 1 D 1", city: "Bursa", payMethod: "havale", items: [{ productId: p.id, quantity: 1 }] })
    expect(placed.status).toBe(200)
    const order = await db.order.findFirstOrThrow({ where: { email } })
    created.orders.push(order.id)
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(0)
    const who = await waiter(p.slug)
    expect((await json(`/api/admin/orders/${order.id}`, admin, "POST", { status: "CANCELLED" })).status).toBe(200)
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(1)
    expect((await db.newsletterSubscriber.findUniqueOrThrow({ where: { email: who.toLowerCase() } })).source).toBe(`shop:${p.slug}:notified`)
    expect(await db.newsletterCampaign.count({ where: { refId: p.id, kind: "restock" } })).toBe(1)
  })
})

describe("scheduled publishing", () => {
  const future = (h: number) => new Date(Date.now() + h * HOUR).toISOString()
  const body = "Bu, zamanlanmış yayın testi için yazılmış yeterince uzun bir gövdedir; yoga, nefes ve meditasyon üzerine birkaç cümle daha ekliyoruz ki doğrulama kuralları geçsin."
  const articleInput = (extra: object = {}) => ({ title: `Zamanlı yazı ${rnd()}`, excerpt: "Zamanlanmış yayın testi için kısa özet metni.", body, category: "Sağlık", status: "DRAFT", ...extra })
  const scheduled: { articles: string[]; episodes: string[]; products: string[] } = { articles: [], episodes: [], products: [] }
  afterAll(async () => {
    await db.article.deleteMany({ where: { id: { in: scheduled.articles } } })
    await db.podcastEpisode.deleteMany({ where: { id: { in: scheduled.episodes } } })
    await db.product.deleteMany({ where: { id: { in: scheduled.products } } })
    await db.newsletterCampaign.deleteMany({ where: { refId: { in: [...scheduled.articles, ...scheduled.episodes, ...scheduled.products] } } })
  })

  it("protects the cron endpoint", async () => {
    expect((await cron("/api/cron/publish", null)).status).toBe(401)
    expect((await cron("/api/cron/publish", "wrong")).status).toBe(401)
  })

  it("an admin can schedule a draft; bad times are refused; editing keeps the schedule and cancelling clears it", async () => {
    const admin = await makeUser("ADMIN")
    const bad = async (scheduledAt: unknown) => (await json("/api/admin/articles", admin, "POST", articleInput({ scheduledAt }))).status
    expect(await bad("nonsense")).toBe(400)
    expect(await bad(future(-5))).toBe(400)
    expect(await bad(future(24 * 400))).toBe(400)

    const at = future(5)
    const res = await json("/api/admin/articles", admin, "POST", articleInput({ scheduledAt: at, notify: true }))
    expect(res.status).toBe(200)
    const a = (await res.json()).article
    scheduled.articles.push(a.id)
    expect(a.status).toBe("DRAFT")
    expect(new Date(a.scheduledAt).toISOString()).toBe(at)
    expect(a.scheduledNotify).toBe(true)
    // it is not public
    expect((await db.article.findFirstOrThrow({ where: { id: a.id } })).publishedAt).toBeNull()
    const list = (await (await api("/api/admin/articles", admin)).json()).articles
    expect(list.find((x: any) => x.id === a.id).scheduledAt).toBeTruthy()

    const edited = (await (await json(`/api/admin/articles/${a.id}`, admin, "PATCH", { title: `Düzenlendi ${rnd()}` })).json()).article
    expect(new Date(edited.scheduledAt).toISOString()).toBe(at) // editing the text does not touch the schedule
    const cancelled = (await (await json(`/api/admin/articles/${a.id}`, admin, "PATCH", { scheduledAt: null })).json()).article
    expect(cancelled.scheduledAt).toBeNull()
    expect(cancelled.scheduledNotify).toBe(false)
  })

  it("publishing by hand or taking a piece down clears its schedule", async () => {
    const admin = await makeUser("ADMIN")
    const a = (await (await json("/api/admin/articles", admin, "POST", articleInput({ scheduledAt: future(3) }))).json()).article
    scheduled.articles.push(a.id)
    const live = (await (await json(`/api/admin/articles/${a.id}`, admin, "PATCH", { status: "PUBLISHED" })).json()).article
    expect(live).toMatchObject({ status: "PUBLISHED", scheduledAt: null })
    const back = (await (await json(`/api/admin/articles/${a.id}`, admin, "PATCH", { status: "DRAFT" })).json()).article
    expect(back).toMatchObject({ status: "DRAFT", scheduledAt: null })
    // a published piece cannot be scheduled
    const pub = (await (await json("/api/admin/articles", admin, "POST", articleInput({ status: "PUBLISHED", scheduledAt: future(3) }))).json()).article
    scheduled.articles.push(pub.id)
    expect(pub.scheduledAt).toBeNull()
  })

  it("publishes what is due (article, episode, product), leaves the rest, announces when asked, and does it once", async () => {
    const admin = await makeUser("ADMIN")
    const past = new Date(Date.now() - 2 * HOUR)
    const author = admin.id
    const due = await db.article.create({ data: { slug: `zt-${rnd()}`, title: "Zamanı gelen yazı", excerpt: "Zamanlanmış yayın testi için kısa özet.", body, category: "Haberler", status: "DRAFT", authorId: author, scheduledAt: past, scheduledNotify: true } })
    const later = await db.article.create({ data: { slug: `zt-${rnd()}`, title: "Zamanı gelmeyen yazı", excerpt: "Zamanlanmış yayın testi için kısa özet.", body, category: "Haberler", status: "DRAFT", authorId: author, scheduledAt: new Date(Date.now() + 5 * HOUR) } })
    const plain = await db.article.create({ data: { slug: `zt-${rnd()}`, title: "Zamansız taslak", excerpt: "Zamanlanmış yayın testi için kısa özet.", body, category: "Haberler", status: "DRAFT", authorId: author } })
    const ep = await db.podcastEpisode.create({ data: { slug: `zt-${rnd()}`, title: "Zamanlı bölüm", description: "Test bölümü.", audioUrl: "/uploads/x.mp3", status: "DRAFT", scheduledAt: past } })
    const pr = await db.product.create({ data: { slug: `zt-${rnd()}`, name: "Zamanlı ürün", summary: "Test ürünü.", description: "Test ürünü.", category: "matlar", priceKurus: 10000, stock: 3, images: "[]", status: "DRAFT", scheduledAt: past } })
    scheduled.articles.push(due.id, later.id, plain.id); scheduled.episodes.push(ep.id); scheduled.products.push(pr.id)

    const runs = await Promise.all([1, 2, 3].map(() => cron("/api/cron/publish").then((r) => r.json())))
    const total = (k: string) => runs.reduce((n, r) => n + r[k], 0)
    expect(total("articles")).toBeGreaterThanOrEqual(1)
    expect(total("episodes")).toBeGreaterThanOrEqual(1)
    expect(total("products")).toBeGreaterThanOrEqual(1)

    const [d, l, p, e, x] = await Promise.all([
      db.article.findUniqueOrThrow({ where: { id: due.id } }), db.article.findUniqueOrThrow({ where: { id: later.id } }), db.article.findUniqueOrThrow({ where: { id: plain.id } }),
      db.podcastEpisode.findUniqueOrThrow({ where: { id: ep.id } }), db.product.findUniqueOrThrow({ where: { id: pr.id } }),
    ])
    expect(d).toMatchObject({ status: "PUBLISHED", scheduledAt: null, scheduledNotify: false })
    expect(d.publishedAt).toBeTruthy()
    expect(e).toMatchObject({ status: "PUBLISHED", scheduledAt: null })
    expect(e.publishedAt).toBeTruthy()
    expect(x).toMatchObject({ status: "PUBLISHED", scheduledAt: null })
    expect(l.status).toBe("DRAFT")
    expect(l.scheduledAt).toBeTruthy()
    expect(p.status).toBe("DRAFT")

    // announced exactly once (a campaign row exists even when no mail server is configured)
    expect(d.notifiedAt).toBeTruthy()
    expect(await db.newsletterCampaign.count({ where: { refId: due.id } })).toBe(1)
    // the episode and product were not flagged: no announcement
    expect(await db.newsletterCampaign.count({ where: { refId: { in: [ep.id, pr.id] } } })).toBe(0)

    // a second run finds nothing more to do for these
    const again = await (await cron("/api/cron/publish")).json()
    expect(await db.newsletterCampaign.count({ where: { refId: due.id } })).toBe(1)
    expect(again.success).toBe(true)
  })

  it("an admin who cancels the schedule between the run's read and its claim wins", async () => {
    const admin = await makeUser("ADMIN")
    const a = await db.article.create({ data: { slug: `zt-${rnd()}`, title: "İptal edilen", excerpt: "Zamanlanmış yayın testi için kısa özet.", body, category: "Haberler", status: "DRAFT", authorId: admin.id, scheduledAt: new Date(Date.now() - HOUR) } })
    scheduled.articles.push(a.id)
    // the claim only succeeds for the exact scheduledAt that was read
    const claimed = await db.article.updateMany({ where: { id: a.id, status: "DRAFT", scheduledAt: new Date(Date.now() - 10 * HOUR) }, data: { status: "PUBLISHED" } })
    expect(claimed.count).toBe(0)
    await json(`/api/admin/articles/${a.id}`, admin, "PATCH", { scheduledAt: null })
    await cron("/api/cron/publish")
    expect((await db.article.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("DRAFT")
  })
})

describe("unpaid orders and inactive students", () => {
  const DAY = 24 * HOUR
  const orderData = (over: object) => ({ code: `AYA-${rnd().toUpperCase().padEnd(6, "X").slice(0, 6)}`, email: `u-${rnd()}@aya.test`, name: "Test", phone: "05320000000", address: "Test mah. Test sok. No 1", city: "Bursa", payMethod: "havale", subtotalKurus: 20000, shippingKurus: 0, totalKurus: 20000, ...over })
  const users: string[] = []
  afterAll(async () => { await db.user.deleteMany({ where: { id: { in: users } } }).catch(() => {}) })

  it("reminds once about a bank-transfer order that waited a day, and only while it is still alive", async () => {
    const student = await makeUser("STUDENT")
    users.push(student.id)
    const mk = async (hoursAgo: number, over: object = {}) => {
      const o = await db.order.create({ data: orderData({ createdAt: new Date(Date.now() - hoursAgo * HOUR), ...over }) })
      created.orders.push(o.id)
      return o
    }
    const waiting = await mk(30, { userId: student.id })
    const fresh = await mk(2)
    const cod = await mk(30, { payMethod: "kapida" })
    const paid = await mk(30, { status: "PAID" })
    const nearlyDead = await mk(2 * 24 + 20) // still inside the 3 days
    const expired = await mk(80) // past the 3 days: the cancellation job handles it, no reminder

    const runs = await Promise.all([1, 2, 3].map(() => cron("/api/cron/reminders").then((r) => r.json())))
    expect(runs.every((r) => typeof r.unpaidOrders === "number")).toBe(true)
    const marks = async (id: string) => (await db.order.findUniqueOrThrow({ where: { id } })).payReminderAt
    expect(await marks(waiting.id)).toBeTruthy()
    expect(await marks(nearlyDead.id)).toBeTruthy()
    for (const o of [fresh, cod, paid, expired]) expect(await marks(o.id), o.code).toBeNull()
    expect(await notes(student.id, "Siparişin ödeme bekliyor")).toBe(1) // three overlapping runs, one message
    const note = await db.notification.findFirstOrThrow({ where: { userId: student.id, title: "Siparişin ödeme bekliyor" } })
    expect(note.body).toContain(waiting.code)
    expect(note.href).toBe(`/shop/siparis/${waiting.code}`)
    await cron("/api/cron/reminders")
    expect(await notes(student.id, "Siparişin ödeme bekliyor")).toBe(1)
  })

  it("nudges a student who has been away for a month — once, not those who are active, new, banned or booked ahead", async () => {
    const old = new Date(Date.now() - 400 * DAY)
    const mkStudent = async (over: object = {}) => {
      const u = await makeUser("STUDENT")
      users.push(u.id)
      await db.user.update({ where: { id: u.id }, data: { createdAt: old, ...over } })
      return u
    }
    const away = await mkStudent()
    const recentBooking = await mkStudent()
    const upcoming = await mkStudent()
    const joinedLately = await mkStudent({ createdAt: new Date(Date.now() - 5 * DAY) })
    const banned = await mkStudent({ banned: true })
    const { teacher } = await makeTeacher()
    await booking(teacher.id, recentBooking.id, -3 * DAY, "COMPLETED")
    await booking(teacher.id, upcoming.id, 2 * DAY)
    const subscribed = await mkStudent()
    await db.newsletterSubscriber.create({ data: { email: subscribed.email.toLowerCase(), unsubscribeToken: `t-${rnd()}${rnd()}` } })
    created.emails.push(subscribed.email.toLowerCase())

    const res = await (await cron("/api/cron/digests?weekly=0")).json()
    expect(res.winback.nudged).toBeGreaterThanOrEqual(2)
    expect(await notes(away.id, "Seni özledik")).toBe(1)
    expect(await notes(subscribed.id, "Seni özledik")).toBe(1)
    for (const u of [recentBooking, upcoming, joinedLately, banned]) expect(await notes(u.id, "Seni özledik")).toBe(0)
    expect((await db.user.findUniqueOrThrow({ where: { id: away.id } })).winbackAt).toBeTruthy()
    const body = (await db.notification.findFirstOrThrow({ where: { userId: away.id, title: "Seni özledik" } })).body!
    expect(body).toContain("yarı fiyat")

    // never twice within 60 days, even with overlapping runs; after 60 days it may come again
    await Promise.all([1, 2].map(() => cron("/api/cron/digests?weekly=0")))
    expect(await notes(away.id, "Seni özledik")).toBe(1)
    await db.user.update({ where: { id: away.id }, data: { winbackAt: new Date(Date.now() - 61 * DAY) } })
    await cron("/api/cron/digests?weekly=0")
    expect(await notes(away.id, "Seni özledik")).toBe(2)
    // ?winback=0 turns it off
    await db.user.update({ where: { id: away.id }, data: { winbackAt: new Date(Date.now() - 61 * DAY) } })
    expect((await (await cron("/api/cron/digests?weekly=0&winback=0")).json()).winback).toBeNull()
    expect(await notes(away.id, "Seni özledik")).toBe(2)
  })
})
