import { describe, it, expect, afterAll } from "vitest"
import { api, db } from "./helpers"

// 203.0.113.0/24 is TEST-NET-3 (RFC 5737): reserved for documentation and examples, never a real routable
// address, and — unlike the 10.x.x.x range the other tests use — NOT in isBannableIp's private-range
// exemption, so the auto-ban system treats it exactly like an ordinary visitor's public IP.
const testIp = () => `203.0.113.${1 + Math.floor(Math.random() * 253)}`
const used: string[] = []
const bannableIp = () => { const ip = testIp(); used.push(ip); return ip }

afterAll(async () => {
  const { clearIpBanCache } = await import("../../src/lib/ban-engine")
  await db.ipBan.deleteMany({ where: { ipAddress: { in: used } } })
  await db.attackLog.deleteMany({ where: { ipAddress: { in: used } } })
  for (const ip of used) clearIpBanCache(ip)
  await db.$disconnect()
})

const hit = (ip: string, path: string, headers: Record<string, string> = {}) =>
  api(path, null, { headers: { "x-forwarded-for": ip, ...headers } })

/** Fire-and-forget: proxy.ts never awaits scanForAttack, so the ban can land a beat after the response. */
async function waitBanned(ip: string, timeoutMs = 4000): Promise<boolean> {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    if ((await hit(ip, "/api/health")).status === 403) return true
    await new Promise((r) => setTimeout(r, 150))
  }
  return false
}

describe("auto-ban: attack-signature scanning", () => {
  it("logs a path-scan signature but does not ban on a single hit", async () => {
    const ip = bannableIp()
    const res = await hit(ip, "/.env")
    expect(res.status).not.toBe(403)
    await new Promise((r) => setTimeout(r, 300))
    const row = await db.attackLog.findFirst({ where: { ipAddress: ip, kind: "PATH_SCAN" } })
    expect(row).not.toBeNull()
    expect(await hit(ip, "/api/health")).toMatchObject({ status: 200 })
  })

  it("bans after 5 path-scan hits from the same IP, and the ban is real (every route, not just the matched one)", async () => {
    const ip = bannableIp()
    for (const p of ["/.env", "/.git/config", "/wp-login.php", "/phpmyadmin/", "/vendor/phpunit/phpunit/phpunit"]) {
      await hit(ip, p)
    }
    expect(await waitBanned(ip)).toBe(true)
    expect((await hit(ip, "/")).status).toBe(403)
    const ban = await db.ipBan.findFirst({ where: { ipAddress: ip, isActive: true } })
    expect(ban?.reason).toContain("saldırı paterni")
    expect((await db.attackLog.count({ where: { ipAddress: ip, autoBanned: true } }))).toBeGreaterThan(0)
  })

  it("bans a request carrying a classic SQL-injection payload the same way", async () => {
    const ip = bannableIp()
    for (let i = 0; i < 5; i++) await hit(ip, `/api/teachers?q=${encodeURIComponent("' OR 1=1 --")}&n=${i}`)
    expect(await waitBanned(ip)).toBe(true)
  })

  it("recognises named scanner/pentest tools by User-Agent and bans after repeated hits", async () => {
    const ip = bannableIp()
    for (let i = 0; i < 5; i++) await hit(ip, `/api/health?n=${i}`, { "user-agent": "sqlmap/1.7.2#stable (http://sqlmap.org)" })
    expect(await waitBanned(ip)).toBe(true)
  })

  it("never flags ordinary browser or generic-client user agents, even many times over", async () => {
    const ip = bannableIp()
    const uas = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
      "curl/8.4.0", "python-requests/2.31.0", "Go-http-client/1.1", "UptimeRobot/2.0",
    ]
    for (let i = 0; i < 8; i++) await hit(ip, `/api/health?n=${i}`, { "user-agent": uas[i % uas.length] })
    expect((await hit(ip, "/api/health")).status).toBe(200)
  })

  it("never auto-bans loopback / private-range addresses no matter how many signatures match", async () => {
    const ip = "10.77.77.77"
    for (let i = 0; i < 8; i++) await hit(ip, `/.env?n=${i}`)
    await new Promise((r) => setTimeout(r, 300))
    expect((await hit(ip, "/api/health")).status).toBe(200)
  })
})

describe("auto-ban: API endpoint enumeration", () => {
  it("bans an IP that probes many distinct, otherwise-unremarkable API paths in a burst", async () => {
    const ip = bannableIp()
    for (let i = 0; i < 32; i++) await hit(ip, `/api/__probe_${i}_${Math.random().toString(36).slice(2)}`)
    expect(await waitBanned(ip)).toBe(true)
    const row = await db.attackLog.findFirst({ where: { ipAddress: ip, kind: "API_ENUM" } })
    expect(row).not.toBeNull()
  })

  it("folds ids out of the path first, so browsing many different resources of the same kind is not enumeration", async () => {
    const ip = bannableIp()
    // 20+ letters each: well past the 16-char fold threshold regardless of which random letters land
    for (let i = 0; i < 40; i++) {
      const id = "id" + i.toString().padStart(4, "0") + "abcdefghijklmnopqrst"
      await hit(ip, `/api/teachers/${id}`)
    }
    expect((await hit(ip, "/api/health")).status).toBe(200)
  })
})
