import { test, expect, devices, Browser, BrowserContext, Page } from "@playwright/test"

/**
 * Device checks: the same pages on phones, tablets and desktops (viewport, pixel ratio, touch and mobile flags of real
 * device profiles; the engine is always the installed Chromium). Nothing may overflow sideways, throw, or break
 * the layout; touch screens get what hover-only features cannot offer.
 */
const profile = (name: string) => {
  const { defaultBrowserType, ...rest } = devices[name]
  void defaultBrowserType
  return rest
}

const DEVICES: { name: string; opts: Record<string, any>; mobile: boolean }[] = [
  { name: "iPhone SE", opts: profile("iPhone SE"), mobile: true },
  { name: "iPhone 13", opts: profile("iPhone 13"), mobile: true },
  { name: "Pixel 7", opts: profile("Pixel 7"), mobile: true },
  { name: "Galaxy S9+", opts: profile("Galaxy S9+"), mobile: true },
  { name: "iPad Mini", opts: profile("iPad Mini"), mobile: false },
  { name: "iPad Mini (yatay)", opts: profile("iPad Mini landscape"), mobile: false },
  { name: "Laptop 1280", opts: { viewport: { width: 1280, height: 720 } }, mobile: false },
  { name: "Masaüstü 1920", opts: { viewport: { width: 1920, height: 1080 } }, mobile: false },
]

const PAGES = ["/", "/pozlar", "/pozlar/savasci-2", "/yoga-stilleri", "/yoga-stilleri/vinyasa", "/nasil-calisir", "/sss", "/hakkimizda", "/ogretmenler-icin", "/teachers", "/atolyeler", "/live", "/icerikler", "/login", "/pricing"]


async function open(browser: Browser, opts: Record<string, any>): Promise<{ ctx: BrowserContext; page: Page }> {
  const ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`
  const ctx = await browser.newContext({ ...opts, extraHTTPHeaders: { "x-forwarded-for": ip } })
  return { ctx, page: await ctx.newPage() }
}

/** scroll through the page so reveal-on-scroll content and lazy images are present */
async function scrollThrough(page: Page) {
  const h = await page.evaluate(() => document.body.scrollHeight)
  const step = Math.max(300, ((page.viewportSize()?.height ?? 800) * 2) / 3)
  for (let y = 0; y < h; y += step) {
    await page.evaluate((v) => window.scrollTo(0, v), y)
    await page.waitForTimeout(60)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
}

for (const d of DEVICES) {
  test.describe(`device: ${d.name}`, () => {
    test("pages fit the screen, throw no errors and load their pictures", async ({ browser }) => {
      test.setTimeout(240_000)
      const { ctx, page } = await open(browser, d.opts)
      const problems: string[] = []
      page.on("pageerror", (e) => problems.push(`error: ${e.message.slice(0, 120)}`))
      for (const path of PAGES) {
        const start = problems.length
        await page.goto(path, { waitUntil: "networkidle" })
        await scrollThrough(page)
        const r = await page.evaluate(() => {
          const W = window.innerWidth
          const overflow = document.documentElement.scrollWidth > W + 1
          const offenders: string[] = []
          if (overflow) {
            for (const el of document.querySelectorAll("body *")) {
              const b = el.getBoundingClientRect()
              if (b.width > 0 && b.right > W + 2) offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 2).join(".")}`)
              if (offenders.length > 3) break
            }
          }
          // pictures that failed (pravatar.cc and other external hosts are not reachable from every network)
          const broken = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.offsetParent !== null && getComputedStyle(i).opacity !== "0" && i.src.startsWith(location.origin) && !i.src.includes("/uploads/posts/x.jpg")).map((i) => i.src.replace(location.origin, ""))
          return { overflow, offenders, broken, sw: document.documentElement.scrollWidth, W }
        })
        if (r.overflow) problems.push(`${path}: sideways scroll ${r.sw} > ${r.W} (${r.offenders.join(", ")})`)
        if (r.broken.length) problems.push(`${path}: broken pictures ${r.broken.join(", ")}`)
        if (problems.length > start) problems[problems.length - 1] = `${path}: ${problems[problems.length - 1]}`
      }
      await ctx.close()
      expect(problems).toEqual([])
    })

    test("navigation works: " + (d.mobile ? "menu button opens the drawer" : "explore menu / menu button"), async ({ browser }) => {
      const { ctx, page } = await open(browser, d.opts)
      await page.goto("/")
      const width = page.viewportSize()!.width
      if (width < 1024) {
        const btn = page.getByRole("button", { name: "Menüyü aç" })
        await expect(btn).toBeVisible()
        const box = await btn.boundingBox()
        expect(Math.min(box!.width, box!.height), "menu button is a comfortable tap target").toBeGreaterThanOrEqual(40)
        await btn.click()
        await expect(page.getByRole("button", { name: "Menüyü kapat" })).toBeVisible()
        const link = page.locator("a[href='/pozlar']").last()
        await link.scrollIntoViewIfNeeded()
        await link.click()
        await expect(page).toHaveURL(/\/pozlar$/)
      } else {
        await page.getByTestId("explore-button").click()
        await page.getByTestId("explore-menu").locator("a[href='/pozlar']").click()
        await expect(page).toHaveURL(/\/pozlar$/)
      }
      await ctx.close()
    })

    test("hero: headline, call to action and 3D scene fit inside the screen", async ({ browser }) => {
      const { ctx, page } = await open(browser, d.opts)
      await page.goto("/")
      const W = page.viewportSize()!.width
      const h1 = page.getByRole("heading", { level: 1 })
      await expect(h1).toBeVisible()
      const cta = page.getByTestId("hero-join")
      await expect(cta).toBeVisible()
      const c = (await cta.boundingBox())!
      expect(c.height, "primary button height").toBeGreaterThanOrEqual(44)
      expect(c.x + c.width).toBeLessThanOrEqual(W)
      const scene = page.getByTestId("scene-3d").first()
      await scene.scrollIntoViewIfNeeded()
      const s = (await scene.boundingBox())!
      expect(s.x).toBeGreaterThanOrEqual(-1)
      expect(s.x + s.width).toBeLessThanOrEqual(W + 1)
      expect(s.height).toBeGreaterThan(250)
      await ctx.close()
    })
  })
}

test.describe("touch screens", () => {
  test("pose cards: play button works by tap, a tap on the card opens the pose", async ({ browser }) => {
    const { ctx, page } = await open(browser, profile("Pixel 7"))
    await page.goto("/pozlar")
    const card = page.getByTestId("pose-card").first()
    await card.scrollIntoViewIfNeeded()
    const play = card.getByTestId("pose-play")
    await expect(play).toBeVisible()
    const box = (await play.boundingBox())!
    expect(box.height, "play button tap target").toBeGreaterThanOrEqual(36)
    await play.tap()
    await expect(card).toHaveAttribute("data-playing", "1")
    await expect(card.getByTestId("pose-motion").locator("canvas")).toBeAttached({ timeout: 30_000 })
    await expect(page).toHaveURL(/\/pozlar$/)
    await play.tap()
    await expect(card).toHaveAttribute("data-playing", "0")
    await card.locator("a").first().tap()
    await expect(page).toHaveURL(/\/pozlar\/[a-z0-9-]+$/)
    await ctx.close()
  })

  test("pose page: play the movement by tap and rotate the model", async ({ browser }) => {
    const { ctx, page } = await open(browser, profile("iPhone 13"))
    await page.goto("/pozlar/ucgen")
    const btn = page.getByTestId("pose-play-motion")
    await btn.scrollIntoViewIfNeeded()
    await btn.tap()
    await expect(page.getByTestId("pose-viewer").locator("canvas")).toBeAttached({ timeout: 30_000 })
    await expect(btn).toContainText("tekrar oynat", { timeout: 60_000 })
    await ctx.close()
  })

  test("small links and close buttons have a touch-sized hit area", async ({ browser }) => {
    const { ctx, page } = await open(browser, profile("iPhone 13"))
    await page.goto("/")
    await scrollThrough(page)
    const small = await page.evaluate(() => {
      const out: string[] = []
      const hit = (e: Element) => {
        // size of the element or of its invisible ::after hit area, whichever is larger
        const r = e.getBoundingClientRect()
        const after = getComputedStyle(e, "::after")
        const grow = after.content !== "none" && after.position === "absolute"
        const insets = grow ? [after.top, after.bottom, after.left, after.right].map((v) => Math.abs(parseFloat(v)) || 0) : [0, 0, 0, 0]
        return { w: r.width + insets[2] + insets[3], h: r.height + insets[0] + insets[1] }
      }
      for (const e of document.querySelectorAll("a, button")) {
        const r = e.getBoundingClientRect()
        const cs = getComputedStyle(e)
        if (r.width === 0 || r.height === 0 || cs.visibility === "hidden") continue
        if (e.tagName === "A" && cs.display === "inline" && e.closest("p, li")) continue // running text
        const { w, h } = hit(e)
        if (Math.min(w, h) < 40) out.push(`${(e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 30)} ${Math.round(w)}x${Math.round(h)}`)
      }
      return out
    })
    expect(small).toEqual([])
    await ctx.close()
  })
})

test.describe("fallbacks", () => {
  test("without WebGL the pictures stay and nothing throws", async ({ browser }) => {
    const { ctx, page } = await open(browser, profile("Pixel 7"))
    await ctx.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: any[]) {
        if (/webgl/i.test(type)) return null
        return (orig as any).call(this, type, ...rest)
      } as any
    })
    const errors: string[] = []
    page.on("pageerror", (e) => errors.push(e.message))
    await page.goto("/")
    await expect(page.getByTestId("scene-3d").first().locator("img")).toBeVisible()
    await page.goto("/pozlar")
    await page.getByTestId("pose-card").first().getByTestId("pose-play").tap()
    await expect(page.getByTestId("pose-card").first().locator("img")).toBeVisible()
    await page.goto("/pozlar/savasci-2")
    await page.getByTestId("pose-3d-toggle").tap()
    await expect(page.getByTestId("pose-viewer")).toHaveAttribute("data-state", "error", { timeout: 20_000 })
    await expect(page.getByText("3B görünüm açılamadı")).toBeVisible()
    expect(errors).toEqual([])
    await ctx.close()
  })

  test("when the 3D model cannot be loaded the still pictures carry the page", async ({ browser }) => {
    const { ctx, page } = await open(browser, profile("iPhone 13"))
    await page.route("**/models/yogi.glb", (r) => r.abort())
    const errors: string[] = []
    page.on("pageerror", (e) => errors.push(e.message))
    await page.goto("/")
    await expect(page.getByTestId("scene-3d").first().locator("img")).toBeVisible()
    await page.goto("/pozlar/savasci-2")
    await expect(page.getByTestId("pose-image")).toBeVisible()
    await page.getByTestId("pose-3d-toggle").tap()
    await expect(page.getByTestId("pose-viewer")).toHaveAttribute("data-state", "error", { timeout: 20_000 })
    expect(errors).toEqual([])
    await ctx.close()
  })

  test("reduced-motion visitors: hovering a card does not start the movement by itself", async ({ browser }) => {
    const { ctx, page } = await open(browser, { viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" })
    await page.goto("/pozlar")
    const card = page.getByTestId("pose-card").first()
    await card.locator("a").hover()
    await page.waitForTimeout(500)
    await expect(card).toHaveAttribute("data-playing", "0")
    await card.getByTestId("pose-play").click() // the explicit button still works
    await expect(card).toHaveAttribute("data-playing", "1")
    await ctx.close()
  })
})

