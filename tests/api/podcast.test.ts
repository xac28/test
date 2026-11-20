import { describe, it, expect, afterAll } from "vitest"
import { readFileSync, rmSync } from "fs"
import path from "path"
import { api, BASE, json, makeUser, db } from "./helpers"

const ids: string[] = []
const files: string[] = []
afterAll(async () => {
  await db.podcastEpisode.deleteMany({ where: { id: { in: ids } } })
  await db.newsletterCampaign.deleteMany({ where: { refId: { in: ids } } })
  for (const f of files) rmSync(path.join(process.cwd(), "public", f), { force: true })
  await db.$disconnect()
})

const rnd = () => Math.random().toString(16).slice(2, 8)
const body = (over: object = {}) => ({ title: `Test bölümü ${rnd()}`, description: "Bu bölüm otomatik testler için oluşturuldu ve silinecek.", audioUrl: "/uploads/audio/test.mp3", durationSec: 185, episodeNo: 7, guest: "Deniz & Ece", ...over })
async function create(admin: { token: string }, over: object = {}) {
  const r = await json("/api/admin/podcast", admin, "POST", body(over))
  expect(r.status).toBe(200)
  const j = await r.json()
  ids.push(j.episode.id)
  return j
}

describe("podcast admin", () => {
  it("only admins manage episodes; drafts stay out of the page and the feed until published", async () => {
    const admin = await makeUser("ADMIN")
    const student = await makeUser("STUDENT")
    expect((await json("/api/admin/podcast", null, "POST", body())).status).toBe(401)
    expect((await json("/api/admin/podcast", student, "POST", body())).status).toBe(403)
    expect((await json("/api/admin/podcast", admin, "POST", body({ title: "x" }))).status).toBe(400)
    expect((await json("/api/admin/podcast", admin, "POST", body({ audioUrl: "javascript:alert(1)" }))).status).toBe(400)

    const { episode: e } = await create(admin)
    expect(e.status).toBe("DRAFT")
    expect(e.publishedAt).toBeNull()
    expect((await api(`/podcast/${e.slug}`)).status).toBe(404)
    expect(await (await api("/podcast/feed.xml")).text()).not.toContain(e.title)

    const pub = await json(`/api/admin/podcast/${e.id}`, admin, "PATCH", { status: "PUBLISHED" })
    expect(pub.status).toBe(200)
    expect((await pub.json()).episode.publishedAt).toBeTruthy()
    const page = await api(`/podcast/${e.slug}`)
    expect(page.status).toBe(200)
    expect(await page.text()).toContain(e.title)
    expect(await (await api("/podcast")).text()).toContain(e.title)

    const feed = await api("/podcast/feed.xml")
    expect(feed.headers.get("content-type")).toContain("application/rss+xml")
    const xml = await feed.text()
    expect(xml).toContain(e.title)
    expect(xml).toContain("<itunes:duration>00:03:05</itunes:duration>")
    expect(xml).toContain("<itunes:episode>7</itunes:episode>")
    expect(xml).toContain("Deniz &amp; Ece") // guest name is escaped
    expect(xml).toMatch(/<enclosure url="[^"]+\/uploads\/audio\/test\.mp3" type="audio\/mpeg"/)

    await json(`/api/admin/podcast/${e.id}`, admin, "PATCH", { status: "DRAFT" })
    expect((await api(`/podcast/${e.slug}`)).status).toBe(404)
    expect((await api(`/api/admin/podcast/${e.id}`, admin, { method: "DELETE" })).status).toBe(200)
    expect(await db.podcastEpisode.count({ where: { id: e.id } })).toBe(0)
  })

  it("counts a listen once per visitor and hour, and only for published episodes", async () => {
    const admin = await makeUser("ADMIN")
    const { episode: draft } = await create(admin)
    const { episode: live } = await create(admin, { status: "PUBLISHED" })
    const headers = { "x-forwarded-for": `10.9.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}` }
    const play = (id: string) => api(`/api/podcast/${id}/play`, null, { method: "POST", headers })
    expect((await (await play(live.id)).json()).counted).toBe(true)
    expect((await (await play(live.id)).json()).counted).toBe(false) // same visitor, same hour
    expect((await (await play(draft.id)).json()).counted).toBe(false)
    expect((await db.podcastEpisode.findUniqueOrThrow({ where: { id: live.id } })).plays).toBe(1)
    expect((await db.podcastEpisode.findUniqueOrThrow({ where: { id: draft.id } })).plays).toBe(0)
  })

  it("tells the newsletter once per episode when asked to", async () => {
    const admin = await makeUser("ADMIN")
    const { episode, newsletter } = await create(admin, { status: "PUBLISHED", notify: true })
    expect(newsletter).toBeTruthy()
    expect(newsletter.recipients).toBeGreaterThanOrEqual(0)
    const rows = await db.newsletterCampaign.findMany({ where: { refId: episode.id } })
    expect(rows).toHaveLength(1)
    expect(rows[0].kind).toBe("podcast")
    expect(rows[0].subject).toContain(episode.title)
    const again = await json(`/api/admin/podcast/${episode.id}`, admin, "PATCH", { notify: true })
    expect((await again.json()).newsletter).toBeNull() // already announced
    expect(await db.newsletterCampaign.count({ where: { refId: episode.id } })).toBe(1)
    const draftNotify = await create(admin, { status: "DRAFT", notify: true })
    expect(draftNotify.newsletter).toBeNull() // drafts are never announced
  })
})

describe("audio upload", () => {
  const upload = (user: { token: string }, bytes: Buffer, name: string, type: string, kind = "audio") => {
    const fd = new FormData()
    fd.append("file", new Blob([new Uint8Array(bytes)], { type }), name)
    fd.append("type", kind)
    return api("/api/upload", user, { method: "POST", body: fd })
  }
  it("takes a real mp3 from an admin and refuses everyone else and fake files", async () => {
    const admin = await makeUser("ADMIN")
    const student = await makeUser("STUDENT")
    const mp3 = readFileSync(path.join(process.cwd(), "tests/fixtures/tone.mp3"))
    expect((await upload(student, mp3, "a.mp3", "audio/mpeg")).status).toBe(403)
    expect((await upload(admin, Buffer.from("<html>not audio at all, just text</html>"), "a.mp3", "audio/mpeg")).status).toBe(400)
    expect((await upload(admin, mp3, "a.mp3", "video/mp4")).status).toBe(400) // wrong declared type for the audio folder
    const ok = await upload(admin, mp3, "a.mp3", "audio/mpeg")
    expect(ok.status).toBe(200)
    const { url } = await ok.json()
    files.push(url)
    expect(url).toMatch(/^\/uploads\/audio\/audio-.*\.mp3$/)
    const served = await fetch(`${BASE}${url}`)
    expect(served.status).toBe(200)
    expect((await served.arrayBuffer()).byteLength).toBe(mp3.byteLength)
    expect((await upload(student, mp3, "a.jpg", "image/jpeg", "product")).status).toBe(403) // product pictures: admin only too
  })
})
