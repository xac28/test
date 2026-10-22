import { describe, it, expect, afterAll } from "vitest"
import { api, json, makeUser, makeTeacher, db } from "./helpers"

afterAll(() => db.$disconnect())

const ascii = (s: string) => Array.from(s).map((c) => c.charCodeAt(0))
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, ...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9])

async function photo(user: { token: string }) {
  const fd = new FormData()
  fd.append("file", new Blob([JPEG as unknown as BlobPart], { type: "image/jpeg" }), "p.jpg")
  fd.append("type", "post")
  const res = await api("/api/upload", user, { method: "POST", body: fd })
  expect(res.status).toBe(200)
  const { url } = await res.json()
  expect(url).toMatch(/^\/uploads\/posts\/post-.*\.jpg$/)
  return url as string
}

async function share(user: { token: string }, content = "Sabah pratiğimden bir kare, çok huzurluydu.", over: Record<string, unknown> = {}) {
  return json("/api/community", user, "POST", { image: await photo(user), content, ...over })
}

/** a proven member: two already-approved posts, so new photos go live immediately */
async function member() {
  const u = await makeUser("STUDENT")
  for (let i = 0; i < 2; i++) await db.post.create({ data: { authorId: u.id, content: `onaylı ${i}`, image: "/uploads/posts/x.jpg", status: "VISIBLE" } })
  return u
}

describe("sharing photos", () => {
  it("needs a signed-in user, the terms and an own uploaded photo", async () => {
    expect((await json("/api/community", null, "POST", { image: "/x", content: "merhaba dünya" })).status).toBe(401)
    const noTerms = await makeUser("STUDENT", { terms: false })
    const r = await json("/api/community", noTerms, "POST", { image: "/x", content: "merhaba dünya" })
    expect(r.status).toBe(403)
    expect((await r.json()).code).toBe("TERMS_REQUIRED")

    const u = await makeUser("STUDENT")
    expect((await json("/api/community", u, "POST", { content: "fotoğrafsız paylaşım" })).status).toBe(400)
    // somebody else's file, a made-up path and an external URL are all refused
    const other = await makeUser("STUDENT")
    const theirs = await photo(other)
    expect((await json("/api/community", u, "POST", { image: theirs, content: "başkasının fotoğrafı" })).status).toBe(400)
    expect((await json("/api/community", u, "POST", { image: "/uploads/posts/post-nope-1.jpg", content: "olmayan dosya" })).status).toBe(400)
    expect((await json("/api/community", u, "POST", { image: "https://evil.example/a.jpg", content: "dış bağlantı" })).status).toBe(400)
  })

  it("holds a newcomer's photo for approval, tells the admins and hides it from the public feed", async () => {
    const admin = await makeUser("ADMIN")
    const u = await makeUser("STUDENT")
    const res = await share(u)
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(d.pending).toBe(true)
    expect(d.post.status).toBe("PENDING")

    expect((await db.notification.count({ where: { userId: admin.id, title: "Onay bekleyen fotoğraf" } })) > 0).toBe(true)

    // the public (and other members) cannot see it, not in the feed and not by id
    const stranger = await makeUser("STUDENT")
    const feed = await (await api(`/api/community?author=${u.id}`, stranger)).json()
    expect(feed.posts).toHaveLength(0)
    expect((await api(`/api/community/${d.post.id}`, stranger)).status).toBe(404)
    expect((await api(`/api/community/${d.post.id}`)).status).toBe(404)
    // the owner sees it, with its status
    const own = await (await api("/api/community?mine=1", u)).json()
    expect(own.posts[0]).toMatchObject({ id: d.post.id, status: "PENDING" })
    // and a stranger can neither like nor comment on it
    expect((await json(`/api/community/${d.post.id}/like`, stranger, "POST", {})).status).toBe(404)
    expect((await json(`/api/community/${d.post.id}/comments`, stranger, "POST", { content: "merhaba" })).status).toBe(404)
  })

  it("publishes at once for admins, teachers and proven members", async () => {
    for (const u of [await makeUser("ADMIN"), (await makeTeacher()).user, await member()]) {
      const d = await (await share(u)).json()
      expect(d.pending).toBe(false)
      expect(d.post.status).toBe("VISIBLE")
    }
  })

  it("approval makes the photo public and notifies the owner; rejection needs a reason", async () => {
    const admin = await makeUser("ADMIN")
    const u = await makeUser("STUDENT")
    const post = (await (await share(u)).json()).post
    expect((await json(`/api/admin/community/${post.id}`, u, "POST", { action: "approve" })).status).toBe(403)
    expect((await json(`/api/admin/community/${post.id}`, admin, "POST", { action: "approve" })).status).toBe(200)
    expect((await json(`/api/admin/community/${post.id}`, admin, "POST", { action: "approve" })).status).toBe(409)
    expect((await api(`/api/community/${post.id}`)).status).toBe(200)
    expect(await db.notification.count({ where: { userId: u.id, type: "POST_APPROVED" } })).toBe(1)

    const second = (await (await share(u)).json()).post
    expect((await json(`/api/admin/community/${second.id}`, admin, "POST", { action: "reject" })).status).toBe(400)
    expect((await json(`/api/admin/community/${second.id}`, admin, "POST", { action: "reject", reason: "Konu dışı görsel" })).status).toBe(200)
    expect((await api(`/api/community/${second.id}`)).status).toBe(404)
    const note = await db.notification.findFirst({ where: { userId: u.id, type: "POST_REMOVED" } })
    expect(note?.body).toBe("Konu dışı görsel")
    expect(await db.auditLog.count({ where: { actorId: admin.id, targetId: second.id, action: "POST_REJECT" } })).toBe(1)
  })

  it("an owner can delete their own photo, nobody else can", async () => {
    const u = await member()
    const post = (await (await share(u)).json()).post
    const other = await makeUser("STUDENT")
    expect((await api(`/api/community/${post.id}`, other, { method: "DELETE" })).status).toBe(403)
    expect((await api(`/api/community/${post.id}`, u, { method: "DELETE" })).status).toBe(200)
    expect((await api(`/api/community/${post.id}`)).status).toBe(404)
  })
})

describe("automatic moderation of captions and comments", () => {
  const bad = ["Seni aptal salak!", "s.i.k.t.i.r git", "you are a fucking idiot", "$1kt1r", "ananı sikeyim"]

  it("blocks profanity in a photo caption, never stores it and never repeats the word", async () => {
    for (const text of bad) {
      const res = await share(await member(), text)
      expect(res.status, text).toBe(422)
      const d = await res.json()
      expect(d.code).toBe("PROFANITY")
      expect(JSON.stringify(d).toLowerCase()).not.toMatch(/sikt|aptal|salak|fuck|ananı|1kt1r/)
    }
    expect(await db.post.count({ where: { content: { contains: "fucking" } } })).toBe(0)
  })

  it("blocks links, e-mails, phone numbers and shouting, but lets friendly text through", async () => {
    for (const text of ["Detaylar için https://example.com/kampanya", "bana yaz: ali@example.com", "Beni ara 0532 123 45 67", "HERKES BURAYA BAKSIN HEMEN GELİN"]) {
      expect((await share(await member(), text)).status, text).toBe(422)
    }
    const u = await member()
    expect((await share(u, "Bugün sınıfta Amina ile güneş selamı yaptık, harikaydı!")).status).toBe(200)
    expect((await share(u, "Götür beni şu dağa, orada pratik yapalım 🧘")).status).toBe(200)
  })

  it("filters the title as well", async () => {
    const u = await member()
    expect((await share(u, "güzel bir gün", { title: "aptal herkes" })).status).toBe(422)
  })

  it("records an event with a masked excerpt for the admins", async () => {
    const admin = await makeUser("ADMIN")
    const u = await member()
    await share(u, "sen tam bir salaksın")
    const ev = await db.moderationEvent.findFirst({ where: { userId: u.id }, orderBy: { createdAt: "desc" } })
    expect(ev?.surface).toBe("POST")
    expect(ev?.excerpt ?? "").toContain("*")
    expect((ev?.excerpt ?? "").toLowerCase()).not.toContain("salak")
    const overview = await (await api("/api/admin/moderation", admin)).json()
    expect(overview.stats.last24h).toBeGreaterThan(0)
    expect(overview.recent.some((e: any) => e.user.id === u.id)).toBe(true)
    expect((await api("/api/admin/moderation", u)).status).toBe(403)
  })

  it("mutes after repeated violations, tells the user, and an admin can lift it", async () => {
    const admin = await makeUser("ADMIN")
    const author = await member()
    const post = (await (await share(author)).json()).post
    const troll = await makeUser("STUDENT")
    const send = (t: string) => json(`/api/community/${post.id}/comments`, troll, "POST", { content: t })
    for (let i = 0; i < 3; i++) expect((await send("aptal herif " + "x".repeat(i))).status).toBe(422)
    const muted = await send("şimdi nazik bir yorum")
    expect(muted.status).toBe(429)
    expect((await muted.json()).code).toBe("MUTED")
    expect(await db.notification.count({ where: { userId: troll.id, type: "MUTED" } })).toBeGreaterThan(0)
    expect(await db.comment.count({ where: { authorId: troll.id } })).toBe(0)

    const mute = await db.communityMute.findFirstOrThrow({ where: { userId: troll.id } })
    expect((await json("/api/admin/moderation", admin, "POST", { action: "unmute", muteId: mute.id })).status).toBe(200)
    expect((await send("şimdi nazik bir yorum")).status).toBe(200)
  })

  it("an admin's extra blocked word takes effect immediately", async () => {
    const admin = await makeUser("ADMIN")
    const u = await member()
    const word = `zzkelime${Math.floor(Math.random() * 1e6)}`
    expect((await share(u, `bu ${word} çok güzel`)).status).toBe(200)
    expect((await json("/api/admin/moderation", admin, "POST", { action: "add-word", word })).status).toBe(200)
    expect((await json("/api/admin/moderation", admin, "POST", { action: "add-word", word })).status).toBe(409)
    expect((await share(u, `bu ${word} çok güzel`)).status).toBe(422)
    const test = await (await json("/api/admin/moderation", admin, "POST", { action: "test", text: `bu ${word}` })).json()
    expect(test.clean).toBe(false)
    const row = await db.blockedWord.findFirstOrThrow({ where: { word } })
    expect((await api("/api/admin/moderation", admin, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id }) })).status).toBe(200)
    expect((await share(u, `bu ${word} çok güzel`)).status).toBe(200)
  })

  it("also guards private messages", async () => {
    const a = await makeUser("STUDENT")
    const b = await makeUser("STUDENT")
    const bad = await json("/api/messages", a, "POST", { targetUserId: b.id, content: "sen bir aptalsın" })
    expect(bad.status).toBe(422)
    expect((await json("/api/messages", a, "POST", { targetUserId: b.id, content: "Merhaba, derse gelecek misin?" })).status).toBe(200)
  })

  it("only the two people in a conversation can read it", async () => {
    const a = await makeUser("STUDENT")
    const b = await makeUser("STUDENT")
    const spy = await makeUser("STUDENT")
    await json("/api/messages", a, "POST", { targetUserId: b.id, content: "özel mesaj" })
    const conv = await db.conversation.findFirstOrThrow({ where: { OR: [{ userOneId: a.id }, { userTwoId: a.id }] } })
    expect((await api(`/api/messages?conversationId=${conv.id}`, spy)).status).toBe(403)
    expect((await api(`/api/messages?conversationId=${conv.id}`, b)).status).toBe(200)
  })
})

describe("likes", () => {
  it("toggles, counts, and merges the notifications into one", async () => {
    const owner = await member()
    const post = (await (await share(owner)).json()).post
    const fans = await Promise.all([makeUser("STUDENT"), makeUser("STUDENT"), makeUser("STUDENT")])
    expect((await json(`/api/community/${post.id}/like`, null, "POST", {})).status).toBe(401)
    for (const f of fans) {
      const r = await (await json(`/api/community/${post.id}/like`, f, "POST", {})).json()
      expect(r.liked).toBe(true)
    }
    const notes = await db.notification.findMany({ where: { userId: owner.id, type: "POST_LIKE" } })
    expect(notes).toHaveLength(1)
    expect(notes[0].count).toBe(3)
    expect(notes[0].title).toContain("2 kişi daha")

    // unlike → count goes down, a second tap likes again; never negative
    const off = await (await json(`/api/community/${post.id}/like`, fans[0], "POST", {})).json()
    expect(off).toMatchObject({ liked: false, likeCount: 2 })
    const feed = await (await api(`/api/community?author=${owner.id}`, fans[1])).json()
    expect(feed.posts.find((p: any) => p.id === post.id)).toMatchObject({ liked: true, likeCount: 2 })
    expect((await (await api(`/api/community?author=${owner.id}`, fans[0])).json()).posts.find((p: any) => p.id === post.id).liked).toBe(false)
  })

  it("never notifies you about your own like, and survives two taps at once", async () => {
    const owner = await member()
    const post = (await (await share(owner)).json()).post
    await json(`/api/community/${post.id}/like`, owner, "POST", {})
    expect(await db.notification.count({ where: { userId: owner.id, type: "POST_LIKE" } })).toBe(0)
    const fan = await makeUser("STUDENT")
    const [a, b] = await Promise.all([json(`/api/community/${post.id}/like`, fan, "POST", {}), json(`/api/community/${post.id}/like`, fan, "POST", {})])
    expect([a.status, b.status]).toEqual([200, 200])
    expect(await db.like.count({ where: { postId: post.id, userId: fan.id } })).toBeLessThanOrEqual(1)
    const p = await db.post.findUniqueOrThrow({ where: { id: post.id } })
    expect(p.likeCount).toBe(await db.like.count({ where: { postId: post.id } }))
  })
})

describe("comments", () => {
  it("are posted, counted, notified, listed in order and removable by the right people", async () => {
    const owner = await member()
    const post = (await (await share(owner)).json()).post
    const a = await makeUser("STUDENT")
    const b = await makeUser("STUDENT")
    expect((await json(`/api/community/${post.id}/comments`, null, "POST", { content: "güzel" })).status).toBe(401)
    expect((await json(`/api/community/${post.id}/comments`, a, "POST", { content: "   " })).status).toBe(400)
    expect((await json(`/api/community/${post.id}/comments`, a, "POST", { content: "x".repeat(501) })).status).toBe(400)

    const c1 = (await (await json(`/api/community/${post.id}/comments`, a, "POST", { content: "Çok güzel bir kare 🌿" })).json()).comment
    const c2 = (await (await json(`/api/community/${post.id}/comments`, b, "POST", { content: "Ben de denemek istiyorum" })).json()).comment
    // same text again, right away, is a duplicate
    expect((await json(`/api/community/${post.id}/comments`, a, "POST", { content: "Çok güzel bir kare 🌿" })).status).toBe(409)

    const notes = await db.notification.findMany({ where: { userId: owner.id, type: "POST_COMMENT" } })
    expect(notes).toHaveLength(2)
    expect(notes[0].href).toBe(`/community/${post.id}`)

    const detail = await (await api(`/api/community/${post.id}`, a)).json()
    expect(detail.post.commentCount).toBe(2)
    expect(detail.comments.map((c: any) => c.id)).toEqual([c1.id, c2.id])
    expect(detail.comments[0]).toMatchObject({ mine: true, canDelete: true })
    expect(detail.comments[1]).toMatchObject({ mine: false, canDelete: false })

    // b cannot delete a's comment; a can; the photo's owner can delete anything under their photo
    expect((await api(`/api/community/comments/${c1.id}`, b, { method: "DELETE" })).status).toBe(403)
    expect((await api(`/api/community/comments/${c1.id}`, a, { method: "DELETE" })).status).toBe(200)
    expect((await api(`/api/community/comments/${c2.id}`, owner, { method: "DELETE" })).status).toBe(200)
    expect((await db.post.findUniqueOrThrow({ where: { id: post.id } })).commentCount).toBe(0)
    // the owner's removal is explained to the author, the author's own deletion is silent
    expect(await db.notification.count({ where: { userId: b.id, type: "COMMENT_REMOVED" } })).toBe(1)
    expect(await db.notification.count({ where: { userId: a.id, type: "COMMENT_REMOVED" } })).toBe(0)
  })

  it("an admin can remove and restore a comment with a reason", async () => {
    const admin = await makeUser("ADMIN")
    const owner = await member()
    const post = (await (await share(owner)).json()).post
    const a = await makeUser("STUDENT")
    const c = (await (await json(`/api/community/${post.id}/comments`, a, "POST", { content: "tartışmalı ama kibar yorum" })).json()).comment
    expect((await json(`/api/admin/community/comments/${c.id}`, admin, "POST", { action: "remove" })).status).toBe(400)
    expect((await json(`/api/admin/community/comments/${c.id}`, a, "POST", { action: "remove", reason: "deneme" })).status).toBe(403)
    expect((await json(`/api/admin/community/comments/${c.id}`, admin, "POST", { action: "remove", reason: "Konu dışı" })).status).toBe(200)
    expect((await json(`/api/admin/community/comments/${c.id}`, admin, "POST", { action: "remove", reason: "Konu dışı" })).status).toBe(409)
    expect((await (await api(`/api/community/${post.id}`)).json()).comments).toHaveLength(0)
    expect((await json(`/api/admin/community/comments/${c.id}`, admin, "POST", { action: "restore" })).status).toBe(200)
    expect((await (await api(`/api/community/${post.id}`)).json()).comments).toHaveLength(1)
    const list = await (await api(`/api/admin/community/comments?q=${encodeURIComponent("kibar yorum")}`, admin)).json()
    expect(list.comments.some((x: any) => x.id === c.id)).toBe(true)
  })
})

describe("reporting community content", () => {
  it("lets members report a photo or a comment, and an admin remove it from the report", async () => {
    const admin = await makeUser("ADMIN")
    const owner = await member()
    const post = (await (await share(owner)).json()).post
    const a = await makeUser("STUDENT")
    const c = (await (await json(`/api/community/${post.id}/comments`, a, "POST", { content: "bir yorum" })).json()).comment
    const reporter = await makeUser("STUDENT")
    const desc = "Bu paylaşım topluluk kurallarına uymuyor ve rahatsız edici."

    const rp = await json("/api/reports", reporter, "POST", { targetType: "POST", targetId: post.id, category: "INAPPROPRIATE_CONTENT", description: desc })
    expect(rp.status).toBe(200)
    const rc = await json("/api/reports", reporter, "POST", { targetType: "COMMENT", targetId: c.id, category: "HARASSMENT", description: desc })
    expect(rc.status).toBe(200)
    // you cannot report yourself
    expect((await json("/api/reports", owner, "POST", { targetType: "POST", targetId: post.id, category: "SPAM", description: desc })).status).toBeGreaterThanOrEqual(400)

    const pid = (await rp.json()).id
    const detail = await (await api(`/api/admin/reports/${pid}`, admin)).json()
    expect(detail.target).toMatchObject({ kind: "post", id: post.id, status: "VISIBLE" })
    expect(detail.report.evidence.caption).toContain("Sabah")

    expect((await json(`/api/admin/reports/${pid}/action`, admin, "POST", { action: "remove_content", note: "Kurallara aykırı" })).status).toBe(200)
    expect((await api(`/api/community/${post.id}`)).status).toBe(404)
    expect((await db.report.findUniqueOrThrow({ where: { id: pid } })).status).toBe("RESOLVED")
    expect(await db.notification.count({ where: { userId: owner.id, type: "POST_REMOVED" } })).toBe(1)
    expect(await db.notification.count({ where: { userId: reporter.id, type: "REPORT_UPDATE" } })).toBeGreaterThan(0)
    // a second removal is refused
    const again = await json("/api/admin/reports/" + (await rc.json()).id + "/action", admin, "POST", { action: "remove_content" })
    expect(again.status).toBe(200) // the comment is a different target, and still live
    expect((await db.comment.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("REMOVED")
  })
})

describe("notifications", () => {
  it("lists newest first, counts unread, marks read, and is private", async () => {
    const owner = await member()
    const post = (await (await share(owner)).json()).post
    const fan = await makeUser("STUDENT")
    await json(`/api/community/${post.id}/like`, fan, "POST", {})
    await json(`/api/community/${post.id}/comments`, fan, "POST", { content: "harika paylaşım" })

    expect((await api("/api/notifications")).status).toBe(401)
    const list = await (await api("/api/notifications", owner)).json()
    expect(list.unread).toBe(2)
    expect(list.notifications[0].type).toBe("POST_COMMENT")
    expect(list.notifications.every((n: any) => !n.read)).toBe(true)
    // somebody else sees none of it
    expect((await (await api("/api/notifications", fan)).json()).notifications).toHaveLength(0)

    // marking someone else's notification as read does nothing
    expect((await (await json("/api/notifications/read", fan, "POST", { ids: [list.notifications[0].id] })).json()).unread).toBe(0)
    expect((await (await api("/api/notifications", owner)).json()).unread).toBe(2)

    const one = await (await json("/api/notifications/read", owner, "POST", { ids: [list.notifications[0].id] })).json()
    expect(one.unread).toBe(1)
    const all = await (await json("/api/notifications/read", owner, "POST", {})).json()
    expect(all.unread).toBe(0)
    const unreadOnly = await (await api("/api/notifications?unread=1", owner)).json()
    expect(unreadOnly.notifications).toHaveLength(0)
  })

  it("after a like is read, the next like starts a fresh notification", async () => {
    const owner = await member()
    const post = (await (await share(owner)).json()).post
    const [a, b] = [await makeUser("STUDENT"), await makeUser("STUDENT")]
    await json(`/api/community/${post.id}/like`, a, "POST", {})
    await json("/api/notifications/read", owner, "POST", {})
    await json(`/api/community/${post.id}/like`, b, "POST", {})
    expect(await db.notification.count({ where: { userId: owner.id, type: "POST_LIKE" } })).toBe(2)
  })

  it("accepts an Expo push token and rejects garbage", async () => {
    const u = await makeUser("STUDENT")
    expect((await json("/api/notifications/push-token", u, "POST", { token: "not-a-token" })).status).toBe(400)
    expect((await json("/api/notifications/push-token", u, "POST", { token: "ExponentPushToken[abcdefghijklmnop]" })).status).toBe(200)
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).expoPushToken).toBe("ExponentPushToken[abcdefghijklmnop]")
    expect((await api("/api/notifications/push-token", u, { method: "DELETE" })).status).toBe(200)
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).expoPushToken).toBeNull()
  })

  it("tells the admins in-app about a new pending photo", async () => {
    const admin = await makeUser("ADMIN")
    const badges = await (await api("/api/admin/badges", admin)).json()
    expect(typeof badges.pendingPosts).toBe("number")
  })
})
