import { describe, it, expect, afterAll } from "vitest"
import crypto from "crypto"
import { api, json, makeUser, makeTeacher, makeBooking, db } from "./helpers"

afterAll(() => db.$disconnect())

const rnd = () => crypto.randomBytes(5).toString("hex").replace(/[0-9]/g, (d) => "abcdefghij"[Number(d)])
const ask = (message: string, user?: { token: string } | null) => json("/api/ai/recommend", user ?? null, "POST", { message })

describe("AYA Rehber learns what it does not know", () => {
  it("records an unknown question, says so, and offers the feedback + support routes", async () => {
    const u = await makeUser("STUDENT")
    const q = `${rnd()} ${rnd()} ${rnd()} nedir`
    const res = await (await ask(q, u)).json()
    expect(res.intent).toBe("unknown")
    expect(res.learning).toBe(true)
    expect(res.reply).toContain("öğreneceğim")
    expect(res.interactionId).toBeTruthy()
    const row = await db.aiInteraction.findUniqueOrThrow({ where: { id: res.interactionId } })
    expect(row).toMatchObject({ kind: "unknown", taught: false, userId: u.id })
  })

  it("never stores e-mail addresses or phone numbers of the visitor", async () => {
    const res = await (await ask(`ali@example.com adresime ${rnd()} gönderin 0532 123 45 67`)).json()
    const row = await db.aiInteraction.findUniqueOrThrow({ where: { id: res.interactionId } })
    expect(row.message).not.toContain("ali@example.com")
    expect(row.message).not.toContain("0532")
    expect(row.message).toContain("[e-posta]")
  })

  it("takes 👍/👎 feedback on an answer and validates the request", async () => {
    const res = await (await ask("Yoga nedir?")).json()
    expect(res.askFeedback).toBe(true)
    expect((await json("/api/ai/feedback", null, "POST", { id: res.interactionId, helpful: false })).status).toBe(200)
    expect((await db.aiInteraction.findUniqueOrThrow({ where: { id: res.interactionId } })).helpful).toBe(false)
    expect((await json("/api/ai/feedback", null, "POST", { id: res.interactionId })).status).toBe(400)
    expect((await json("/api/ai/feedback", null, "POST", { id: "nope", helpful: true })).status).toBe(404)
    // greetings and the support hand-off are not rated
    expect((await (await ask("merhaba")).json()).askFeedback).toBe(false)
    expect((await (await ask("canlı destek")).json()).askFeedback).toBe(false)
  })

  it("an admin teaches the answer; it is used from then on, counted, rated and the askers are told", async () => {
    const admin = await makeUser("ADMIN")
    const asker = await makeUser("STUDENT")
    const word = rnd()
    const question = `${word} ${rnd()} ${rnd()}`
    const first = await (await ask(question, asker)).json()
    expect(first.intent).toBe("unknown")

    // only admins
    expect((await json("/api/admin/ai", asker, "POST", { action: "teach", question, answer: "deneme cevabı" })).status).toBe(403)
    // validation
    expect((await json("/api/admin/ai", admin, "POST", { action: "teach", question, answer: "x" })).status).toBe(400)
    expect((await json("/api/admin/ai", admin, "POST", { action: "teach", question, answer: "Geçerli cevap", linkHref: "javascript:alert(1)" })).status).toBe(400)

    const queue = await (await api("/api/admin/ai?view=unknown&q=" + word, admin)).json()
    expect(queue.items[0]).toMatchObject({ count: 1 })
    const taught = await json("/api/admin/ai", admin, "POST", { action: "teach", question, answer: `**${word}** kampanyası ödeme sayfasında kodla kullanılır.`, linkLabel: "Paketler", linkHref: "/pricing", norm: queue.items[0].norm })
    expect(taught.status).toBe(200)
    const t = await taught.json()
    expect(t.notified).toBe(1)
    expect(await db.notification.count({ where: { userId: asker.id, title: "Sorduğun soruya cevap ekledik" } })).toBe(1)
    expect((await api("/api/admin/ai?view=unknown&q=" + word, admin).then((r) => r.json())).items).toHaveLength(0)

    const again = await (await ask(`${question} acaba`, asker)).json()
    expect(again.intent).toBe("taught")
    expect(again.reply).toContain("ödeme sayfasında")
    expect(again.links[0]).toEqual({ label: "Paketler", href: "/pricing" })
    await json("/api/ai/feedback", asker, "POST", { id: again.interactionId, helpful: true })
    const row = await db.aiTaughtAnswer.findUniqueOrThrow({ where: { id: t.id } })
    expect(row.hits).toBeGreaterThanOrEqual(1)
    expect(row.helpful).toBe(1)

    // disable → no longer used; delete removes it
    expect((await api(`/api/admin/ai/taught/${t.id}`, admin, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: false }) })).status).toBe(200)
    expect((await (await ask(question, asker)).json()).intent).toBe("unknown")
    expect((await api(`/api/admin/ai/taught/${t.id}`, admin, { method: "DELETE" })).status).toBe(200)
    expect((await api(`/api/admin/ai/taught/${t.id}`, admin, { method: "DELETE" })).status).toBe(404)
  })

  it("an admin can dismiss nonsense, and sees feedback and overview numbers", async () => {
    const admin = await makeUser("ADMIN")
    const q = `${rnd()} ${rnd()} ${rnd()}`
    const r = await (await ask(q)).json()
    const norm = (await db.aiInteraction.findUniqueOrThrow({ where: { id: r.interactionId } })).norm
    expect((await json("/api/admin/ai", admin, "POST", { action: "dismiss", norm })).status).toBe(200)
    expect((await db.aiInteraction.findUniqueOrThrow({ where: { id: r.interactionId } })).dismissed).toBe(true)
    await json("/api/ai/feedback", null, "POST", { id: r.interactionId, helpful: false })
    const unhelpful = await (await api("/api/admin/ai?view=unhelpful", admin)).json()
    expect(unhelpful.items.some((i: any) => i.id === r.interactionId)).toBe(true)
    const ov = await (await api("/api/admin/ai?view=overview", admin)).json()
    expect(ov.asked7).toBeGreaterThan(0)
    expect((await api("/api/admin/ai?view=overview", await makeUser("STUDENT"))).status).toBe(403)
  })

  it("understands requests for a human, in Turkish and English", async () => {
    for (const m of ["canlı destek istiyorum", "yetkili biriyle konuşmak istiyorum", "bir insanla konuşabilir miyim", "müşteri temsilcisi", "I want to talk to a person", "live support please"]) {
      const res = await (await ask(m)).json()
      expect(res.action, m).toBe("support")
    }
    const signedOut = await (await ask("canlı destek")).json()
    expect(signedOut.links.some((l: any) => l.href.startsWith("/login"))).toBe(true)
    const u = await makeUser("STUDENT")
    expect((await (await ask("canlı destek", u)).json()).links).toHaveLength(0)
  })
})

describe("live support conversations", () => {
  it("needs a signed-in member", async () => {
    expect((await json("/api/support", null, "POST", { message: "merhaba" })).status).toBe(401)
    expect((await api("/api/support")).status).toBe(401)
  })

  it("full cycle: member writes, admin replies and notes, member is notified, closes and rates", async () => {
    const admin = await makeUser("ADMIN")
    const u = await makeUser("STUDENT")
    expect((await json("/api/support", u, "POST", { message: "   " })).status).toBe(400)
    expect((await json("/api/support", u, "POST", { message: "sen bir aptalsın" })).status).toBe(400)

    const created = await (await json("/api/support", u, "POST", { message: "Ödememi yaptım ama dersim görünmüyor", source: "AI_UNHELPFUL", context: "ders neden görünmüyor" })).json()
    expect(created.created).toBe(true)
    const id = created.ticketId
    // a second message goes into the same conversation
    const more = await (await json("/api/support", u, "POST", { message: "Sipariş numaram yok" })).json()
    expect(more).toMatchObject({ created: false, ticketId: id })
    expect(await db.supportTicket.count({ where: { userId: u.id } })).toBe(1)
    expect(await db.notification.count({ where: { userId: admin.id, title: "Yeni canlı destek talebi" } })).toBeGreaterThan(0)

    // admin queue
    const list = await (await api("/api/admin/support?status=waiting&q=" + encodeURIComponent(u.email), admin)).json()
    expect(list.tickets).toHaveLength(1)
    expect(list.tickets[0]).toMatchObject({ id, source: "AI_UNHELPFUL", awaitingStaff: true })
    expect(list.stats.waiting).toBeGreaterThan(0)
    expect((await api("/api/admin/support", u)).status).toBe(403)
    const badges = await (await api("/api/admin/badges", admin)).json()
    expect(badges.openSupport).toBeGreaterThan(0)

    // admin opens it: context shows the system line with the last question
    const detail = await (await api(`/api/admin/support/${id}`, admin)).json()
    expect(detail.messages[0].content).toContain("ders neden görünmüyor")
    expect(detail.user.email).toBe(u.email)

    // internal note stays internal
    expect((await json(`/api/admin/support/${id}`, admin, "POST", { action: "note", content: "Ödeme kaydı kontrol edilecek" })).status).toBe(200)
    expect((await json(`/api/admin/support/${id}`, admin, "POST", { action: "reply", content: "" })).status).toBe(400)
    expect((await json(`/api/admin/support/${id}`, u, "POST", { action: "reply", content: "ben de yetkiliyim" })).status).toBe(403)
    expect((await json(`/api/admin/support/${id}`, admin, "POST", { action: "reply", content: "Merhaba, kaydınızı kontrol ediyorum." })).status).toBe(200)

    const mine = await (await api(`/api/support/${id}`, u)).json()
    expect(mine.messages.some((m: any) => m.role === "NOTE")).toBe(false)
    expect(mine.messages.some((m: any) => m.role === "STAFF" && m.content.includes("kontrol ediyorum"))).toBe(true)
    expect(mine.ticket.awaitingStaff).toBe(false)
    expect(await db.notification.count({ where: { userId: u.id, type: "SUPPORT_REPLY" } })).toBeGreaterThan(0)
    // polling with "after" only brings new messages
    const last = mine.messages[mine.messages.length - 1].createdAt
    expect((await (await api(`/api/support/${id}?after=${encodeURIComponent(last)}`, u)).json()).messages).toHaveLength(0)
    // opening the conversation cleared the bell
    expect(await db.notification.count({ where: { userId: u.id, type: "SUPPORT_REPLY", readAt: null } })).toBe(0)

    // someone else cannot read or write in it
    const other = await makeUser("STUDENT")
    expect((await api(`/api/support/${id}`, other)).status).toBe(404)
    expect((await json(`/api/support/${id}`, other, "POST", { content: "selam" })).status).toBe(404)

    // member answers → awaiting again → admin queue again
    expect((await json(`/api/support/${id}`, u, "POST", { content: "Teşekkürler, bekliyorum." })).status).toBe(200)
    expect((await db.supportTicket.findUniqueOrThrow({ where: { id } })).awaitingStaff).toBe(true)

    // member closes and rates; closed conversations take no more messages
    expect((await api(`/api/support/${id}`, u, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "close" }) })).status).toBe(200)
    expect((await json(`/api/support/${id}`, u, "POST", { content: "tekrar" })).status).toBe(409)
    expect((await api(`/api/support/${id}`, u, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rate", rating: 9 }) })).status).toBe(400)
    expect((await api(`/api/support/${id}`, u, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "rate", rating: 5, comment: "Çok hızlıydı" }) })).status).toBe(200)
    const t = await db.supportTicket.findUniqueOrThrow({ where: { id } })
    expect(t).toMatchObject({ status: "CLOSED", rating: 5, firstReplyAt: expect.any(Date) })

    // a new conversation can be opened after closing; admins can reopen an old one only if none is open
    const second = await (await json("/api/support", u, "POST", { message: "Yeni bir sorum var" })).json()
    expect(second.created).toBe(true)
    expect((await json(`/api/admin/support/${id}`, admin, "POST", { action: "reopen" })).status).toBe(409)
    expect((await json(`/api/admin/support/${second.ticketId}`, admin, "POST", { action: "close" })).status).toBe(200)
    expect((await json(`/api/admin/support/${id}`, admin, "POST", { action: "reopen" })).status).toBe(200)
    // audit trail
    expect(await db.auditLog.count({ where: { actorId: admin.id, targetId: id } })).toBeGreaterThanOrEqual(3)
  })

  it("exports the queue as CSV", async () => {
    const admin = await makeUser("ADMIN")
    const res = await api("/api/admin/support?status=all&format=csv", admin)
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/csv")
    expect((await res.text()).split("\n")[0]).toContain("Konu")
  })
})

describe("teacher reviews: moderation and reporting", () => {
  async function reviewed(comment = "Çok güzel bir dersti, teşekkürler") {
    const { user: tUser, teacher } = await makeTeacher()
    const student = await makeUser("STUDENT")
    const booking = await makeBooking(teacher.id, student.id, "COMPLETED")
    const r = await json("/api/reviews", student, "POST", { bookingId: booking.id, rating: 5, comment })
    return { tUser, teacher, student, booking, res: r }
  }

  it("blocks abusive review text with the community filter", async () => {
    const { res } = await reviewed("berbat bir aptal")
    expect(res.status).toBe(422)
    expect((await reviewed("Harika")).res.status).toBe(200)
  })

  it("shows written reviews publicly; a reported review is removed by an admin and stops counting", async () => {
    const admin = await makeUser("ADMIN")
    const { tUser, teacher, student, res } = await reviewed("Eğitmen gayet nazikti")
    const review = (await res.json()).review
    const list = await (await api(`/api/teachers/${teacher.id}/reviews`)).json()
    expect(list.reviews).toHaveLength(1)
    expect(list.reviews[0].comment).toBe("Eğitmen gayet nazikti")
    expect(JSON.stringify(list)).not.toContain(student.email)

    // the teacher reports it
    const rep = await json("/api/reports", tUser, "POST", { targetType: "REVIEW", targetId: review.id, category: "HARASSMENT", description: "Bu yorum asılsız ve beni küçük düşürmeye yönelik." })
    expect(rep.status).toBe(200)
    const repId = (await rep.json()).id
    // the author cannot report their own review
    expect((await json("/api/reports", student, "POST", { targetType: "REVIEW", targetId: review.id, category: "SPAM", description: "Kendi yorumumu bildiriyorum ama bu olmaz." })).status).toBeGreaterThanOrEqual(400)

    const detail = await (await api(`/api/admin/reports/${repId}`, admin)).json()
    expect(detail.target).toMatchObject({ kind: "review", status: "VISIBLE" })
    expect((await api(`/api/admin/reviews?reported=1`, admin).then((r) => r.json())).reviews.some((r: any) => r.id === review.id)).toBe(true)

    expect((await json(`/api/admin/reports/${repId}/action`, admin, "POST", { action: "remove_content", note: "Asılsız" })).status).toBe(200)
    expect((await db.review.findUniqueOrThrow({ where: { id: review.id } })).status).toBe("REMOVED")
    expect((await (await api(`/api/teachers/${teacher.id}/reviews`)).json()).reviews).toHaveLength(0)
    expect(await db.notification.count({ where: { userId: student.id, type: "COMMENT_REMOVED" } })).toBe(1)

    // restore from the reviews tab
    expect((await json(`/api/admin/reviews/${review.id}`, admin, "POST", { action: "restore" })).status).toBe(200)
    expect((await (await api(`/api/teachers/${teacher.id}/reviews`)).json()).reviews).toHaveLength(1)
    // direct removal needs a reason and an admin
    expect((await json(`/api/admin/reviews/${review.id}`, admin, "POST", { action: "remove" })).status).toBe(400)
    expect((await json(`/api/admin/reviews/${review.id}`, student, "POST", { action: "remove", reason: "deneme" })).status).toBe(403)
    expect((await json(`/api/admin/reviews/${review.id}`, admin, "POST", { action: "remove", reason: "Uygunsuz içerik" })).status).toBe(200)
  })
})

describe("system event log", () => {
  it("records sign-ins, failed sign-ins and uploads, filterable and exportable, admin-only", async () => {
    const admin = await makeUser("ADMIN")
    const u = await makeUser("STUDENT")
    const ok = await json("/api/mobile/auth/login", null, "POST", { email: u.email, password: u.password })
    expect(ok.status).toBe(200)
    await json("/api/mobile/auth/login", null, "POST", { email: u.email, password: "yanlis-sifre" })
    const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9])
    const fd = new FormData()
    fd.append("file", new Blob([JPEG as unknown as BlobPart], { type: "image/jpeg" }), "a.jpg")
    fd.append("type", "post")
    await api("/api/upload", u, { method: "POST", body: fd })
    await new Promise((r) => setTimeout(r, 400))

    const q = encodeURIComponent(u.email)
    const all = await (await api(`/api/admin/logs?range=1h&q=${q}`, admin)).json()
    const types = all.events.map((e: any) => e.type)
    expect(types).toEqual(expect.arrayContaining(["AUTH_LOGIN", "AUTH_FAIL"]))
    const up = await (await api(`/api/admin/logs?range=1h&type=UPLOAD&q=${u.id}`, admin)).json()
    expect(up.events[0].meta.url).toMatch(/^\/uploads\/posts\//)
    const warn = await (await api(`/api/admin/logs?range=1h&level=warn&q=${q}`, admin)).json()
    expect(warn.events.every((e: any) => e.level === "warn")).toBe(true)
    expect(all.stats.hours).toHaveLength(24)
    expect(all.types.length).toBeGreaterThan(0)

    expect((await api("/api/admin/logs", u)).status).toBe(403)
    expect((await api("/api/admin/logs")).status).toBe(401)
    const csv = await api(`/api/admin/logs?range=1h&q=${q}&format=csv`, admin)
    expect(csv.headers.get("content-type")).toContain("text/csv")
    expect(await csv.text()).toContain("AUTH_FAIL")
  })

  it("the admin-actions log can be filtered by topic and period", async () => {
    const admin = await makeUser("ADMIN")
    const u = await makeUser("STUDENT")
    await json("/api/support", u, "POST", { message: "log denemesi" })
    const t = await db.supportTicket.findFirstOrThrow({ where: { userId: u.id } })
    await json(`/api/admin/support/${t.id}`, admin, "POST", { action: "reply", content: "yanıt" })
    const res = await (await api("/api/admin/audit?prefix=SUPPORT&range=24h", admin)).json()
    expect(res.logs.length).toBeGreaterThan(0)
    expect(res.logs.every((l: any) => l.action.startsWith("SUPPORT"))).toBe(true)
  })
})
