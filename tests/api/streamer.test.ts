import { describe, it, expect, afterAll } from "vitest"
import fs from "fs"
import path from "path"
import crypto from "crypto"
import { decode } from "next-auth/jwt"
import { api, json, makeUser, makeTeacher, BASE, db } from "./helpers"
import { hashSecret, newPairCode } from "../../src/lib/streamer"

afterAll(() => db.$disconnect())

const DL_DIR = path.join(process.cwd(), "storage", "downloads")
const META = path.join(DL_DIR, "streamer.json")
const haveRelease = fs.existsSync(META)

async function trialTeacher() {
  const t = await makeTeacher()
  await db.teacher.update({ where: { id: t.teacher.id }, data: { isTrialMode: true } })
  return t
}
/** a pairing code created straight in the database (the endpoint that creates one is tested separately) */
async function code(userId: string, over: { expiresAt?: Date } = {}) {
  const c = newPairCode()
  await db.streamerPairing.create({ data: { userId, codeHash: hashSecret(c), expiresAt: over.expiresAt ?? new Date(Date.now() + 600_000) } })
  return c
}
const pair = (c: string, ip?: string) => api("/api/streamer/pair", null, { method: "POST", headers: { "Content-Type": "application/json", ...(ip ? { "x-forwarded-for": ip } : {}) }, body: JSON.stringify({ code: c, deviceName: "Test bilgisayarı", appVersion: "1.0.0" }) })
async function pairedDevice(userId: string) {
  const res = await pair(await code(userId))
  expect(res.status).toBe(200)
  return (await res.json()) as { token: string; expiresAt: string }
}
const bearer = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } })
const withRelease = async (patch: (meta: any) => any, fn: () => Promise<void>) => {
  const original = fs.readFileSync(META, "utf8")
  try {
    fs.writeFileSync(META, JSON.stringify(patch(JSON.parse(original))))
    await fn()
  } finally {
    fs.writeFileSync(META, original)
  }
}

describe("who may download the installer", () => {
  it.skipIf(!haveRelease)("anonymous 401, students 403, teachers (approved and trial) and admins 200 — byte for byte the published file", async () => {
    expect((await api("/api/streamer/download")).status).toBe(401)
    expect((await api("/api/streamer/info")).status).toBe(401)
    const student = await makeUser("STUDENT")
    const denied = await api("/api/streamer/download", student)
    expect(denied.status).toBe(403)
    expect((await denied.json()).code).toBe("ROLE")
    expect((await api("/api/streamer/info", student)).status).toBe(403)

    const meta = JSON.parse(fs.readFileSync(META, "utf8"))
    for (const who of [(await makeTeacher()).user, (await trialTeacher()).user, await makeUser("ADMIN")]) {
      const res = await api("/api/streamer/download", who)
      expect(res.status).toBe(200)
      expect(res.headers.get("content-disposition")).toContain(`attachment; filename="${meta.file}"`)
      expect(res.headers.get("cache-control")).toContain("no-store")
      expect(res.headers.get("x-content-type-options")).toBe("nosniff")
      const buf = Buffer.from(await res.arrayBuffer())
      expect(buf.length).toBe(Number(res.headers.get("content-length")))
      expect(crypto.createHash("sha256").update(buf).digest("hex")).toBe(meta.sha256)
      expect(buf.subarray(0, 2).toString()).toBe("MZ") // a Windows executable
    }
    const info = await (await api("/api/streamer/info", (await makeTeacher()).user)).json()
    expect(info).toMatchObject({ available: true, release: { version: meta.version, sha256: meta.sha256 } })
  })

  it("suspended, banned and deleted accounts are refused, and refusals are logged", async () => {
    const t = (await makeTeacher()).user
    await db.user.update({ where: { id: t.id }, data: { suspendedUntil: new Date(Date.now() + 86_400_000), suspensionReason: "test" } })
    const res = await api("/api/streamer/download", t)
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe("SUSPENDED")
    expect(await db.eventLog.count({ where: { userId: t.id, message: { contains: "indirme reddedildi" } } })).toBe(1)

    const banned = (await makeTeacher()).user
    await db.user.update({ where: { id: banned.id }, data: { banned: true } })
    expect((await api("/api/streamer/download", banned)).status).toBe(401) // banned sessions do not resolve at all
    const gone = (await makeTeacher()).user
    await db.user.update({ where: { id: gone.id }, data: { deletedAt: new Date() } })
    expect((await api("/api/streamer/download", gone)).status).toBe(401)
  })

  it("a teacher account without a teacher profile gets a clear refusal", async () => {
    const orphan = await makeUser("TEACHER")
    const res = await api("/api/streamer/download", orphan)
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe("NO_PROFILE")
  })

  it.skipIf(!haveRelease)("the file has no public address and the metadata cannot point outside its folder", async () => {
    const meta = JSON.parse(fs.readFileSync(META, "utf8"))
    for (const p of [`/storage/downloads/${meta.file}`, `/downloads/${meta.file}`, `/${meta.file}`, `/uploads/${meta.file}`, "/storage/downloads/streamer.json"]) {
      expect((await api(p)).status, p).toBe(404)
    }
    const teacher = (await makeTeacher()).user
    await withRelease((m) => ({ ...m, file: "../../.env" }), async () => {
      const res = await api("/api/streamer/download", teacher)
      expect(res.status).toBe(404) // only the base name is ever used
      expect(await res.text()).not.toContain("DATABASE_URL")
    })
    await withRelease((m) => ({ ...m, file: "yok-boyle-bir-dosya.exe" }), async () => {
      expect((await api("/api/streamer/download", teacher)).status).toBe(404)
      expect((await (await api("/api/streamer/info", teacher)).json()).available).toBe(false)
    })
  })
})

describe("pairing a computer", () => {
  it("only teachers get a code; it is short, stored hashed, and old unused ones are retired", async () => {
    expect((await json("/api/streamer/pairing", null, "POST", {})).status).toBe(401)
    const student = await makeUser("STUDENT")
    expect((await json("/api/streamer/pairing", student, "POST", {})).status).toBe(403)

    const { user } = await makeTeacher()
    const first = await (await json("/api/streamer/pairing", user, "POST", {})).json()
    expect(first.code).toMatch(/^[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{4}$/)
    const rows = await db.streamerPairing.findMany({ where: { userId: user.id } })
    expect(rows).toHaveLength(1)
    expect(rows[0].codeHash).toBe(hashSecret(first.code))
    expect(JSON.stringify(rows)).not.toContain(first.code)
    expect(rows[0].expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(600_000)
    for (let i = 0; i < 4; i++) await json("/api/streamer/pairing", user, "POST", {})
    expect(await db.streamerPairing.count({ where: { userId: user.id, usedAt: null } })).toBeLessThanOrEqual(3)
  })

  it("a code works once and gives a long token that is stored only as a hash", async () => {
    const { user } = await makeTeacher()
    const c = await code(user.id)
    const res = await pair(c.toLowerCase().replace("-", " ")) // spacing and case do not matter
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(d.token).toMatch(/^ayas_[0-9a-f]{64}$/)
    const dev = await db.streamerDevice.findFirstOrThrow({ where: { userId: user.id } })
    expect(dev.tokenHash).toBe(hashSecret(d.token))
    expect(JSON.stringify(dev)).not.toContain(d.token)
    expect(dev.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000)
    const again = await pair(c)
    expect(again.status).toBe(400)
    expect((await again.json()).code).toBe("CODE_INVALID")
  })

  it("wrong, malformed, expired and spent codes all get the same answer", async () => {
    const { user } = await makeTeacher()
    const expired = await code(user.id, { expiresAt: new Date(Date.now() - 1000) })
    for (const bad of [newPairCode(), "ABCD", "", "AAAA-AAA!", expired, "0000-0000", "x".repeat(300)]) {
      const r = await pair(bad)
      expect(r.status, bad).toBe(400)
      expect((await r.json()).code).toBe("CODE_INVALID")
    }
    expect((await api("/api/streamer/pair", null, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status).toBe(400)
    expect(await db.streamerDevice.count({ where: { userId: user.id } })).toBe(0)
  })

  it("two computers racing with one code: exactly one wins", async () => {
    const { user } = await makeTeacher()
    const c = await code(user.id)
    const results = await Promise.all([1, 2, 3, 4].map(() => pair(c)))
    expect(results.filter((r) => r.status === 200)).toHaveLength(1)
    expect(await db.streamerDevice.count({ where: { userId: user.id } })).toBe(1)
  })

  it("guessing is throttled per address", async () => {
    const ip = `10.99.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`
    const statuses: number[] = []
    for (let i = 0; i < 12; i++) statuses.push((await pair(newPairCode(), ip)).status)
    expect(statuses.slice(0, 8).every((s) => s === 400)).toBe(true)
    expect(statuses.slice(8)).toContain(429)
    // a different address is not affected
    expect((await pair(newPairCode())).status).toBe(400)
  })

  it("a code of somebody who lost access in the meantime is refused", async () => {
    const { user } = await makeTeacher()
    const c = await code(user.id)
    await db.user.update({ where: { id: user.id }, data: { suspendedUntil: new Date(Date.now() + 86_400_000) } })
    const r = await pair(c)
    expect(r.status).toBe(403)
    expect(await db.streamerDevice.count({ where: { userId: user.id } })).toBe(0)
    const student = await makeUser("STUDENT")
    const sc = await code(student.id) // even a code that should never exist for a student
    expect((await pair(sc)).status).toBe(403)
  })

  it("at most five computers per teacher", async () => {
    const { user } = await makeTeacher()
    for (let i = 0; i < 5; i++) await pairedDevice(user.id)
    const extra = await json("/api/streamer/pairing", user, "POST", {})
    expect(extra.status).toBe(409)
    expect((await extra.json()).code).toBe("TOO_MANY_DEVICES")
    expect((await pair(await code(user.id))).status).toBe(409)
  })
})

describe("what the app's token can and cannot do", () => {
  it("me / session need a valid device token; garbage, revoked, expired and foreign tokens are refused", async () => {
    const { user } = await makeTeacher()
    const dev = await pairedDevice(user.id)
    const me = await api("/api/streamer/me", null, bearer(dev.token))
    expect(me.status).toBe(200)
    expect((await me.json()).user.email).toBe(user.email)

    for (const h of [undefined, "Bearer", "Bearer nope", `Bearer ayas_${"0".repeat(64)}`, "Bearer " + "a".repeat(200), `Basic ${dev.token}`]) {
      const r = await api("/api/streamer/me", null, h ? { headers: { Authorization: h } } : {})
      expect(r.status, String(h)).toBe(401)
      expect((await api("/api/streamer/session", null, { method: "POST", ...(h ? { headers: { Authorization: h } } : {}) })).status, String(h)).toBe(401)
    }
    // a normal session token (mobile app) is not a device token
    expect((await api("/api/streamer/me", null, bearer(user.token))).status).toBe(401)
    // and the device token is no key to the rest of the API
    expect((await api("/api/profile/export", null, bearer(dev.token))).status).toBe(401)
    expect((await api("/api/streamer/devices", null, bearer(dev.token))).status).toBe(401)
    expect((await json("/api/room/instant", { token: dev.token }, "POST", { title: "x" })).status).toBe(401)

    await db.streamerDevice.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() - 1000) } })
    expect((await api("/api/streamer/me", null, bearer(dev.token))).status).toBe(401)
  })

  it("access follows the owner: suspension, ban, deletion and loss of the teacher role cut the app off at once", async () => {
    const mk = async () => {
      const t = await makeTeacher()
      return { ...t, dev: await pairedDevice(t.user.id) }
    }
    const probe = async (dev: { token: string }) => [(await api("/api/streamer/me", null, bearer(dev.token))).status, (await api("/api/streamer/session", null, { method: "POST", ...bearer(dev.token) })).status]

    const a = await mk()
    expect(await probe(a.dev)).toEqual([200, 200])
    await db.user.update({ where: { id: a.user.id }, data: { suspendedUntil: new Date(Date.now() + 86_400_000) } })
    expect(await probe(a.dev)).toEqual([403, 403])
    await db.user.update({ where: { id: a.user.id }, data: { suspendedUntil: null } })
    expect(await probe(a.dev)).toEqual([200, 200]) // the suspension ended: the same app works again

    const b = await mk()
    await db.user.update({ where: { id: b.user.id }, data: { banned: true } })
    expect(await probe(b.dev)).toEqual([403, 403])
    const c = await mk()
    await db.user.update({ where: { id: c.user.id }, data: { deletedAt: new Date() } })
    expect(await probe(c.dev)).toEqual([403, 403])
    const d = await mk()
    await db.user.update({ where: { id: d.user.id }, data: { role: "STUDENT" } })
    expect(await probe(d.dev)).toEqual([403, 403])
  })

  it("deleting the account removes every device and code", async () => {
    const t = await makeTeacher()
    await pairedDevice(t.user.id)
    await code(t.user.id)
    const res = await json("/api/profile/account", t.user, "DELETE", { confirm: "HESABIMI SİL", password: t.user.password })
    expect(res.status).toBe(200)
    expect(await db.streamerDevice.count({ where: { userId: t.user.id } })).toBe(0)
    expect(await db.streamerPairing.count({ where: { userId: t.user.id } })).toBe(0)
  })

  it("the session cookie really signs the teacher in: the studio opens and a broadcast can be started with it", async () => {
    const { user } = await makeTeacher()
    const dev = await pairedDevice(user.id)
    const r = await api("/api/streamer/session", null, { method: "POST", ...bearer(dev.token) })
    expect(r.status).toBe(200)
    const { cookie } = await r.json()
    expect(cookie.name).toMatch(/authjs\.session-token$/)
    expect(cookie.expiresAt - Date.now()).toBeLessThanOrEqual(12 * 3600 * 1000 + 5000)
    const claims = await decode({ token: cookie.value, secret: process.env.AUTH_SECRET!, salt: cookie.name })
    expect(claims?.sub).toBe(user.id)
    expect(claims?.role).toBe("TEACHER")

    const jar = `${cookie.name}=${cookie.value}`
    const studio = await fetch(`${BASE}/live/studio`, { headers: { cookie: jar }, redirect: "manual" })
    expect(studio.status).toBe(200) // not a redirect to /login
    const start = await fetch(`${BASE}/api/room/instant`, { method: "POST", headers: { cookie: jar, "Content-Type": "application/json", "x-forwarded-for": "10.7.7.7" }, body: JSON.stringify({ title: "Uygulamadan yayın" }) })
    expect(start.status).toBe(200)
    const room = await start.json()
    expect(room.supervised).toBe(false)
    await fetch(`${BASE}/api/room/instant`, { method: "DELETE", headers: { cookie: jar, "Content-Type": "application/json" }, body: JSON.stringify({ liveRoomId: room.liveRoomId }) })

    // a forged or tampered cookie opens nothing
    const forged = await fetch(`${BASE}/live/studio`, { headers: { cookie: `${cookie.name}=${cookie.value.slice(0, -4)}AAAA` }, redirect: "manual" })
    expect([307, 302, 303]).toContain(forged.status)
  })

  it("a trial teacher's app opens the studio too, and the broadcast it starts is supervised", async () => {
    const { user } = await trialTeacher()
    const dev = await pairedDevice(user.id)
    const { cookie } = await (await api("/api/streamer/session", null, { method: "POST", ...bearer(dev.token) })).json()
    const start = await fetch(`${BASE}/api/room/instant`, { method: "POST", headers: { cookie: `${cookie.name}=${cookie.value}`, "Content-Type": "application/json", "x-forwarded-for": "10.7.7.8" }, body: JSON.stringify({ title: "Deneme yayını (uygulama)" }) })
    expect(start.status).toBe(200)
    const room = await start.json()
    expect(room.supervised).toBe(true)
    await db.liveRoom.update({ where: { id: room.liveRoomId }, data: { isActive: false, endedAt: new Date() } })
  })

  it.skipIf(!haveRelease)("versions below the published minimum are cut off", async () => {
    const { user } = await makeTeacher()
    const dev = await pairedDevice(user.id)
    await withRelease((m) => ({ ...m, minVersion: "9.9.9" }), async () => {
      const old = await api("/api/streamer/session", null, { method: "POST", headers: { Authorization: `Bearer ${dev.token}`, "X-Streamer-Version": "1.0.0" } })
      expect(old.status).toBe(426)
      expect((await old.json()).code).toBe("UPDATE_REQUIRED")
      const unknown = await api("/api/streamer/session", null, { method: "POST", ...bearer(dev.token) }) // no version header at all
      expect(unknown.status).toBe(426)
      const ok = await api("/api/streamer/session", null, { method: "POST", headers: { Authorization: `Bearer ${dev.token}`, "X-Streamer-Version": "10.0.0" } })
      expect(ok.status).toBe(200)
    })
  })
})

describe("managing and removing computers", () => {
  it("a teacher lists and removes only their own; the removed app is locked out at once", async () => {
    const a = await makeTeacher()
    const b = await makeTeacher()
    const devA = await pairedDevice(a.user.id)
    await pairedDevice(b.user.id)
    expect((await api("/api/streamer/devices")).status).toBe(401)
    const list = await (await api("/api/streamer/devices", a.user)).json()
    expect(list.devices).toHaveLength(1)
    expect(JSON.stringify(list)).not.toContain("tokenHash")
    expect(JSON.stringify(list)).not.toContain(devA.token)
    const mine = list.devices[0].id

    const bList = await (await api("/api/streamer/devices", b.user)).json()
    expect((await api(`/api/streamer/devices/${bList.devices[0].id}`, a.user, { method: "DELETE" })).status).toBe(404) // not theirs
    expect((await api(`/api/streamer/devices/${mine}`, null, { method: "DELETE" })).status).toBe(401)
    expect((await api(`/api/streamer/devices/${mine}`, a.user, { method: "DELETE" })).status).toBe(200)
    expect((await api("/api/streamer/me", null, bearer(devA.token))).status).toBe(401)
    expect((await api(`/api/streamer/devices/${mine}`, a.user, { method: "DELETE" })).status).toBe(404) // already gone
    expect((await (await api("/api/streamer/devices", a.user)).json()).devices).toHaveLength(0)
    // the other teacher's computer still works
    expect(await db.streamerDevice.count({ where: { userId: b.user.id, revokedAt: null } })).toBe(1)
  })

  it("the app can sign itself out; the answer is the same for unknown tokens", async () => {
    const { user } = await makeTeacher()
    const dev = await pairedDevice(user.id)
    expect((await api("/api/streamer/logout", null, { method: "POST", ...bearer(dev.token) })).status).toBe(200)
    expect((await api("/api/streamer/me", null, bearer(dev.token))).status).toBe(401)
    expect((await api("/api/streamer/logout", null, { method: "POST", ...bearer(`ayas_${"1".repeat(64)}`) })).status).toBe(200)
    expect((await api("/api/streamer/logout", null, { method: "POST" })).status).toBe(401)
    expect(await db.eventLog.count({ where: { userId: user.id, message: { contains: "çıkış yaptı" } } })).toBe(1)
  })

  it("every step is in the system log", async () => {
    const { user } = await makeTeacher()
    await json("/api/streamer/pairing", user, "POST", {})
    const dev = await pairedDevice(user.id)
    const id = (await (await api("/api/streamer/devices", user)).json()).devices[0].id
    await api(`/api/streamer/devices/${id}`, user, { method: "DELETE" })
    const msgs = (await db.eventLog.findMany({ where: { userId: user.id, type: "SECURITY" } })).map((e) => e.message)
    for (const part of ["eşleştirme kodu oluşturuldu", "eşleştirildi", "cihazı kaldırıldı"]) expect(msgs.some((m) => m.includes(part)), part).toBe(true)
    void dev
  })
})
