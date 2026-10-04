import { describe, it, expect, afterAll } from "vitest"
import { api, makeUser, makeTeacher, json, db, BASE } from "./helpers"

afterAll(() => db.$disconnect())

const ascii = (s: string) => Array.from(s).map((c) => c.charCodeAt(0))
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, ...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9])
const MP4 = new Uint8Array([0, 0, 0, 0x18, ...ascii("ftypmp42"), 0, 0, 0, 0, ...ascii("mp42isom"), 0, 0, 0, 8, ...ascii("free")])
const MOV = new Uint8Array([0, 0, 0, 0x14, ...ascii("ftypqt  "), 0, 0, 0, 0, ...ascii("qt  ")])

function form(bytes: Uint8Array, name: string, type: string, kind: string) {
  const fd = new FormData()
  fd.append("file", new Blob([bytes as unknown as BlobPart], { type }), name)
  fd.append("type", kind)
  return fd
}
const up = (user: { token: string } | null, body: FormData) => api("/api/upload", user, { method: "POST", body })

describe("mobile-style uploads (Bearer token, phone MIME quirks)", () => {
  it("requires authentication", async () => {
    expect((await up(null, form(JPEG, "a.jpg", "image/jpeg", "avatar"))).status).toBe(401)
  })

  it("avatar: accepts a JPEG labelled image/jpg with no extension, and updates the profile image", async () => {
    const user = await makeUser("STUDENT")
    const res = await up(user, form(JPEG, "IMG_0001", "image/jpg", "avatar"))
    expect(res.status).toBe(200)
    const { url } = await res.json()
    expect(url).toMatch(/^\/uploads\/avatars\/avatar-.*\.jpg$/)
    expect((await db.user.findUnique({ where: { id: user.id } }))?.image).toBe(url)

    // served back (also covers the runtime-uploads route used by `next start`)
    const file = await fetch(`${BASE}${url}`)
    expect(file.status).toBe(200)
    expect(file.headers.get("content-type")).toBe("image/jpeg")
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(JPEG)
  })

  it("avatar: rejects a file whose bytes are not an image", async () => {
    const user = await makeUser("STUDENT")
    const res = await up(user, form(new TextEncoder().encode("<script>alert(1)</script>"), "x.jpg", "image/jpeg", "avatar"))
    expect(res.status).toBe(400)
  })

  it("video: accepts MP4 and iPhone QuickTime .mov, serves ranges", async () => {
    const user = await makeUser("STUDENT")
    const mp4 = await up(user, form(MP4, "clip.mp4", "video/mp4", "video"))
    expect(mp4.status).toBe(200)
    const mov = await up(user, form(MOV, "IMG_9999.MOV", "video/quicktime", "video"))
    expect(mov.status).toBe(200)
    const { url } = await mov.json()
    expect(url).toMatch(/\.mov$/)

    const ranged = await fetch(`${BASE}${url}`, { headers: { Range: "bytes=0-3" } })
    expect(ranged.status).toBe(206)
    expect(ranged.headers.get("content-range")).toMatch(/^bytes 0-3\/\d+$/)
    expect((await ranged.arrayBuffer()).byteLength).toBe(4)
  })

  it("video: rejects an image posing as a video and an executable posing as mp4", async () => {
    const user = await makeUser("STUDENT")
    expect((await up(user, form(JPEG, "a.mp4", "video/mp4", "video"))).status).toBe(400)
    expect((await up(user, form(new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0]), "a.exe", "video/mp4", "video"))).status).toBe(400)
    expect((await up(user, form(MP4, "a.mp4", "application/x-msdownload", "video"))).status).toBe(400)
  })

  it("uploads route refuses traversal and unknown extensions", async () => {
    expect([400, 404]).toContain((await fetch(`${BASE}/uploads/..%2f..%2fpackage.json`)).status)
    expect((await fetch(`${BASE}/uploads/avatars/nope.jpg`)).status).toBe(404)
    expect((await fetch(`${BASE}/uploads/avatars/x.html`)).status).toBe(404)
  })
})

describe("teacher videos (what the mobile screen calls)", () => {
  it("create → list → delete, owner only", async () => {
    const { user } = await makeTeacher()
    const other = (await makeTeacher()).user
    const created = await json("/api/teacher/videos", user, "POST", { title: "Sabah akışı", videoUrl: "/uploads/videos/x.mp4", description: "d", isPublic: true })
    expect(created.status).toBe(200)
    const { video } = await created.json()

    const mine = await (await api("/api/teacher/videos", user)).json()
    expect(mine.videos.map((v: any) => v.id)).toContain(video.id)
    const theirs = await (await api("/api/teacher/videos", other)).json()
    expect(theirs.videos.map((v: any) => v.id)).not.toContain(video.id)

    expect((await api(`/api/teacher/videos/${video.id}`, other, { method: "DELETE" })).status).toBe(404)
    expect((await api(`/api/teacher/videos/${video.id}`, user, { method: "DELETE" })).status).toBe(200)
    expect((await api("/api/teacher/videos", null)).status).toBe(401)
  })
})
