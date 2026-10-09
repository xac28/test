import path from "path"
import { test, expect, makeAccount, newSession, db } from "./helpers"
import type { Page } from "@playwright/test"

// A recorded walk through the whole site: every page, every internal link, images, the video upload → play cycle,
// all admin tabs and a phone-sized pass. Screenshots land in test-results/tour/ and a video of each test is kept.
test.use({ video: { mode: "on", size: { width: 1280, height: 800 } }, viewport: { width: 1280, height: 800 } })

const SHOTS = "tour-output"
const IGNORED = [/Failed to fetch RSC payload/, /authjs\.dev#autherror/, /ERR_TUNNEL_CONNECTION_FAILED/, /Failed to load resource/, /favicon/, /fonts\.g/, /pravatar/, /unsplash/, /DevTools/, /WebSocket/i, /livekit/i, /ERR_NAME_NOT_RESOLVED/, /net::ERR/]
// Playwright's open-source Chromium has no H.264 decoder, so playback is checked with a WebM (VP8/Opus); an MP4 is only uploaded.
const SAMPLE = path.join(process.cwd(), "tests", "fixtures", "sample.webm")

function watch(page: Page) {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`))
  page.on("console", (m) => { if (m.type() === "error" && !IGNORED.some((r) => r.test(m.text()))) errors.push(`console: ${m.text()}`) })
  return errors
}
const slug = (p: string) => p.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home"

test.describe("site tour", () => {
  test("public pages: render, no errors, images load, every internal link answers", async ({ page, request }) => {
    test.setTimeout(240_000)
    const errors = watch(page)
    const ws = await db.workshop.findFirst({ where: { status: "PUBLISHED" } })
    const art = await db.article.findFirst({ where: { status: "PUBLISHED" } })
    const teacher = await db.teacher.findFirst({ where: { isTrialMode: false } })
    const pages = ["/", "/atolyeler", ws && `/atolyeler/${ws.slug}`, "/live", "/teachers", teacher && `/teachers/${teacher.id}`, "/teachers/ayse-yilmaz", "/icerikler", art && `/icerikler/${art.slug}`, "/community", "/community/rules", "/pricing", "/become-teacher", "/login", "/login?mode=register", "/terms", "/privacy"].filter(Boolean) as string[]

    const links = new Map<string, string>()
    const brokenImages: string[] = []
    for (const p of pages) {
      const res = await page.goto(p)
      expect(res?.status(), p).toBeLessThan(400)
      await page.waitForLoadState("networkidle").catch(() => {})
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)) // lazy images
      await page.waitForTimeout(400)
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: `${SHOTS}/public-${slug(p)}.png`, fullPage: true })
      const imgs = await page.$$eval("img", (els) => els.filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc).map((i) => i.currentSrc))
      for (const src of imgs) brokenImages.push(`${p}: ${src}`)
      for (const href of await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href") || ""))) {
        if (/^\/(?!\/)/.test(href) && !href.startsWith("/api/") && !href.startsWith("/uploads/")) links.set(href.split("#")[0], p)
      }
    }
    // every internal link found on those pages must answer without an error
    const bad: string[] = []
    for (const [href, from] of links) {
      const r = await request.get(href, { maxRedirects: 5 })
      if (r.status() >= 400) bad.push(`${r.status()} ${href} (linked from ${from})`)
    }
    console.log(`checked ${links.size} internal links on ${pages.length} pages`)
    expect(bad, "broken internal links").toEqual([])
    expect(brokenImages, "images that did not load").toEqual([])
    expect(errors).toEqual([])
  })

  test("navbar, footer and the guide widget on a desktop and a phone", async ({ page, browser }) => {
    test.setTimeout(120_000)
    const errors = watch(page)
    await page.goto("/")
    const nav = page.getByRole("navigation", { name: "Ana menü" })
    // "Dersler" asks visitors to sign in first (the live pages are members-only), then returns to /live
    for (const [label, url] of [["Atölye", /\/atolyeler$/], ["Dersler", /\/(live$|login\?callbackUrl=%2Flive$)/], ["Yoga", /\/yoga-stilleri$/], ["Yazılar", /\/icerikler$/], ["Shop", /\/shop$/], ["Podcast", /\/podcast$/], ["Topluluk", /\/community$/]] as const) {
      await nav.getByRole("link", { name: label, exact: true }).click()
      await expect(page).toHaveURL(url)
      await expect(page.locator("h1").first()).toBeVisible()
    }
    // footer links
    await page.goto("/")
    const footerLinks = await page.$$eval("footer a[href^='/']", (as) => as.map((a) => a.getAttribute("href")!))
    expect(footerLinks.length).toBeGreaterThan(4)
    for (const href of footerLinks) {
      const r = await page.goto(href)
      expect(r?.status(), href).toBeLessThan(400)
    }
    // language switch
    await page.goto("/")
    await page.getByRole("button", { name: /^en$/i }).first().click()
    await expect(page.getByRole("navigation", { name: "Ana menü" })).toContainText("Workshops")
    await page.getByRole("button", { name: /^tr$/i }).first().click()
    await expect(page.getByRole("navigation", { name: "Ana menü" })).toContainText("Atölye")
    // the guide opens, answers, links
    await page.getByTestId("ai-toggle").click()
    await page.getByTestId("ai-input").fill("Bel ağrım için hangi yoga?")
    await page.getByTestId("ai-send").click()
    await expect(page.getByTestId("ai-message").last()).toContainText(/eğitmen|yoga/i, { timeout: 15_000 })
    await page.screenshot({ path: `${SHOTS}/guide-open.png` })

    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
    const m = await ctx.newPage()
    const mErrors = watch(m)
    for (const p of ["/", "/atolyeler", "/teachers", "/community", "/pricing", "/login"]) {
      await m.goto(p)
      await m.waitForLoadState("networkidle").catch(() => {})
      const overflow = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, `${p} horizontal overflow on phone`).toBeLessThanOrEqual(1)
      await m.screenshot({ path: `${SHOTS}/phone-${slug(p)}.png` })
    }
    await m.goto("/")
    await m.getByRole("button", { name: "Menüyü aç" }).click()
    await expect(m.getByRole("link", { name: "Topluluk" }).first()).toBeVisible()
    await ctx.close()
    expect(errors).toEqual([])
    expect(mErrors).toEqual([])
  })

  test("teacher uploads a video, it plays on the dashboard and on the public profile; bad links are refused", async ({ browser }) => {
    test.setTimeout(180_000)
    const t = await makeAccount("TEACHER", { name: "Video Eğitmen" })
    const s = await newSession(browser, t.email)
    const errors = watch(s.page)
    await s.page.goto("/teach")
    await expect(s.page.getByTestId("video-manager")).toBeVisible()
    await expect(s.page.getByTestId("video-empty")).toBeVisible()
    await s.page.getByTestId("video-add-toggle").click()

    // validation first
    await s.page.getByTestId("video-save").click()
    await expect(s.page.getByTestId("video-error")).toBeVisible()
    await s.page.getByTestId("video-title").fill("aptal salak video")
    await s.page.getByTestId("video-file").setInputFiles(SAMPLE)
    await s.page.getByTestId("video-save").click()
    await expect(s.page.getByTestId("video-error")).toContainText(/topluluk kurallarına|uygunsuz/i)

    // a javascript: link is refused by the server
    const refused = await s.page.evaluate(async () => {
      const r = await fetch("/api/teacher/videos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Zararlı", videoUrl: "javascript:alert(1)" }) })
      return r.status
    })
    expect(refused).toBe(400)
    const foreign = await s.page.evaluate(async () => (await fetch("/api/teacher/videos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Başkasının", videoUrl: "/uploads/videos/video-someoneelse-1.mp4" }) })).status)
    expect(foreign).toBe(400)

    // the real upload with progress
    await s.page.getByTestId("video-title").fill("Sabah akışı — 6 saniyelik deneme")
    await s.page.getByTestId("video-save").click()
    await expect(s.page.getByTestId("video-item")).toHaveCount(1, { timeout: 60_000 })
    await s.page.screenshot({ path: `${SHOTS}/teacher-video-uploaded.png`, fullPage: true })

    // plays on the dashboard
    const player = s.page.getByTestId("video-player")
    await expect(player).toBeVisible()
    await expect.poll(() => player.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 20_000 }).toBeGreaterThanOrEqual(2)
    const dur = await player.evaluate((v: HTMLVideoElement) => v.duration)
    expect(dur).toBeGreaterThan(5)
    expect(await player.evaluate((v: HTMLVideoElement) => v.videoWidth)).toBe(640)
    await player.evaluate(async (v: HTMLVideoElement) => { v.muted = true; await v.play() })
    await expect.poll(() => player.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 15_000 }).toBeGreaterThan(0.5)
    await player.evaluate((v: HTMLVideoElement) => { v.currentTime = 4 }) // seeking works (range requests)
    await expect.poll(() => player.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 10_000 }).toBeGreaterThanOrEqual(4)

    // the file is served with range support
    const url = await player.evaluate((v: HTMLVideoElement) => v.getAttribute("src"))
    const ranged = await s.page.request.get(url!, { headers: { Range: "bytes=0-99" } })
    expect(ranged.status()).toBe(206)
    expect(ranged.headers()["content-type"]).toContain("video/webm")

    // public profile: poster → click → plays
    const tid = t.teacher!.id
    const v = await newSession(browser, (await makeAccount("STUDENT")).email)
    await v.page.goto(`/teachers/${tid}`)
    await expect(v.page.getByTestId("recorded-video")).toHaveCount(1, { timeout: 20_000 })
    await v.page.getByTestId("recorded-play").click()
    const pub = v.page.getByTestId("recorded-player")
    await expect(pub).toBeVisible()
    await expect.poll(() => pub.evaluate((x: HTMLVideoElement) => x.currentTime), { timeout: 15_000 }).toBeGreaterThan(0.3)
    await v.page.screenshot({ path: `${SHOTS}/public-profile-video-playing.png`, fullPage: true })

    // private videos stay off the public profile
    await s.page.getByTestId("video-add-toggle").click()
    await s.page.getByTestId("video-src-link").click()
    await s.page.getByTestId("video-url").fill("https://example.com/ders.mp4")
    await s.page.getByTestId("video-title").fill("Dışarıdan bağlantı")
    await s.page.getByRole("checkbox").uncheck()
    await s.page.getByTestId("video-save").click()
    await expect(s.page.getByTestId("video-item")).toHaveCount(2, { timeout: 15_000 })
    await v.page.reload()
    await expect(v.page.getByTestId("recorded-video")).toHaveCount(1) // the private one is hidden

    // delete with an in-page confirmation
    await s.page.getByTestId("video-delete").first().click()
    await s.page.getByTestId("video-delete-confirm").click()
    await expect(s.page.getByTestId("video-item")).toHaveCount(1)
    await s.ctx.close(); await v.ctx.close()
    expect(errors).toEqual([])
  })

  test("signed-in student: dashboard, profile, notifications, support, reports, messages, community", async ({ browser }) => {
    test.setTimeout(150_000)
    const stu = await makeAccount("STUDENT", { name: "Gezgin Öğrenci" })
    const s = await newSession(browser, stu.email)
    const errors = watch(s.page)
    for (const p of ["/dashboard", "/dashboard/profile", "/dashboard/notifications", "/dashboard/support", "/dashboard/reports", "/messages", "/community"]) {
      const r = await s.page.goto(p)
      expect(r?.status(), p).toBeLessThan(400)
      await s.page.waitForLoadState("networkidle").catch(() => {})
      await expect(s.page.locator("h1, h2").first()).toBeVisible()
      await s.page.screenshot({ path: `${SHOTS}/student-${slug(p)}.png`, fullPage: true })
    }
    // every sidebar link on the dashboard works
    await s.page.goto("/dashboard")
    await s.page.locator("aside nav a[href]").first().waitFor()
    const hrefs = await s.page.$$eval("aside nav a[href]", (as) => Array.from(new Set(as.map((a) => a.getAttribute("href")!))))
    expect(hrefs.length).toBeGreaterThan(3)
    for (const h of hrefs) {
      const r = await s.page.goto(h)
      expect(r?.status(), h).toBeLessThan(400)
    }
    // the bell opens and links to the full list
    await s.page.goto("/dashboard")
    await s.page.getByTestId("bell").click()
    await expect(s.page.getByTestId("bell-menu")).toBeVisible()
    await s.page.getByRole("link", { name: "Tüm bildirimler" }).click()
    await expect(s.page).toHaveURL(/dashboard\/notifications/)
    // profile menu
    await s.page.goto("/")
    await s.page.getByTestId("profile-menu-button").click()
    await expect(s.page.getByRole("menuitem", { name: "Panelim" })).toBeVisible()
    await s.ctx.close()
    expect(errors).toEqual([])
  })

  test("every admin tab opens, shows its content and leaves the console clean", async ({ browser }) => {
    test.setTimeout(240_000)
    const admin = await makeAccount("ADMIN")
    const a = await newSession(browser, admin.email)
    const errors = watch(a.page)
    await a.page.goto("/admin")
    const tabs = await a.page.$$eval("aside nav a[data-testid^='nav-']", (as) => as.map((x) => (x.getAttribute("data-testid") || "").replace("nav-", "")))
    expect(tabs.length).toBeGreaterThanOrEqual(18)
    for (const id of tabs) {
      await a.page.goto(`/admin?tab=${id}`)
      await expect(a.page.getByTestId(`nav-${id}`)).toHaveAttribute("aria-current", "page")
      await a.page.waitForLoadState("networkidle").catch(() => {})
      await expect(a.page.locator("main h2, main h1").first()).toBeVisible({ timeout: 20_000 })
      await a.page.waitForTimeout(500)
      await a.page.screenshot({ path: `${SHOTS}/admin-${id}.png`, fullPage: true })
      const empty = await a.page.locator("main").innerText()
      expect(empty, `${id} tab shows an error`).not.toMatch(/Internal|Yüklenemedi|undefined|\[object Object\]/)
    }
    await a.ctx.close()
    expect(errors).toEqual([])
  })
})
