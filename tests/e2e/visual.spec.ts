import { test, expect, makeAccount, newSession } from "./helpers"

test.describe("landing page: motion, 3D and sign-up funnel", () => {
  test("hero shows the 3D scene (or its static fallback) without errors, and the join CTA leads to registration", async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", (e) => errors.push(e.message))
    await page.goto("/")
    const scene = page.getByTestId("scene-3d").first()
    await expect(scene).toBeVisible()
    await expect(scene.locator("canvas, svg").first()).toBeAttached({ timeout: 15_000 })
    if (await scene.locator("canvas").count()) {
      const box = await scene.locator("canvas").boundingBox()
      expect(box!.width).toBeGreaterThan(200)
      expect(box!.height).toBeGreaterThan(250)
    }
    await expect(page.getByTestId("hero-join")).toBeVisible()
    await page.getByTestId("hero-join").click()
    await expect(page).toHaveURL(/\/login\?mode=register$/)
    await expect(page.getByRole("heading", { name: "Hesap oluştur" })).toBeVisible()
    expect(errors).toEqual([])
  })

  test("the join band and the scroll nudge invite visitors, and the nudge can be dismissed for the session", async ({ page }) => {
    await page.goto("/")
    await page.getByTestId("join-band").scrollIntoViewIfNeeded()
    await expect(page.getByTestId("join-band-cta")).toBeVisible()
    const nudge = page.getByTestId("signup-nudge")
    await expect(nudge).toBeVisible({ timeout: 10_000 })
    await nudge.getByRole("button", { name: "Kapat" }).click()
    await expect(nudge).toHaveCount(0)
    await page.reload()
    await page.getByTestId("join-band").scrollIntoViewIfNeeded()
    await page.mouse.wheel(0, 800)
    await page.waitForTimeout(800)
    await expect(page.getByTestId("signup-nudge")).toHaveCount(0) // stays dismissed
  })

  test("members are not nagged: no join CTA, no nudge", async ({ browser }) => {
    const m = await makeAccount("STUDENT")
    const s = await newSession(browser, m.email)
    await s.page.goto("/")
    await expect(s.page.getByTestId("hero-join")).toHaveCount(0)
    await s.page.mouse.wheel(0, 1500)
    await s.page.waitForTimeout(800)
    await expect(s.page.getByTestId("signup-nudge")).toHaveCount(0)
    await s.ctx.close()
  })

  test("reduced-motion visitors get a still page", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" })
    const page = await ctx.newPage()
    await page.goto("/")
    const anim = await page.evaluate(() => getComputedStyle(document.querySelector(".aurora-blob")!).animationName)
    expect(anim).toBe("none")
    await ctx.close()
  })

  test("the login page carries the lotus scene and honours ?mode=register", async ({ page }) => {
    await page.goto("/login?mode=register")
    await expect(page.getByRole("heading", { name: "Hesap oluştur" })).toBeVisible()
    await expect(page.getByTestId("scene-3d")).toHaveAttribute("data-variant", "lotus")
    await page.goto("/login")
    await expect(page.getByRole("heading", { name: "Giriş yap" })).toBeVisible()
  })
})
