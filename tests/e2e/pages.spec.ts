import { test, expect, makeAccount, newSession } from "./helpers"

test.describe("discovery pages: styles, poses, how it works, FAQ", () => {
  test("home page walks visitors through styles, poses, workshops and FAQ", async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", (e) => errors.push(e.message))
    await page.goto("/")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await page.getByTestId("home-styles").scrollIntoViewIfNeeded()
    await expect(page.getByTestId("home-styles").locator("a[href^='/yoga-stilleri/']").first()).toBeVisible()
    await page.getByTestId("home-poses").scrollIntoViewIfNeeded()
    await expect(page.getByTestId("home-poses").locator("a[href^='/pozlar/']").first()).toBeVisible()
    await page.getByTestId("home-faq").scrollIntoViewIfNeeded()
    await page.getByTestId("home-faq").getByTestId("faq-item").first().click()
    await expect(page.getByTestId("home-faq").getByTestId("faq-item").first()).toHaveAttribute("open", "")
    expect(errors).toEqual([])
  })

  test("explore menu lists the info pages and navigates", async ({ page }) => {
    await page.goto("/")
    await page.getByTestId("explore-button").click()
    const menu = page.getByTestId("explore-menu")
    await expect(menu).toBeVisible()
    for (const href of ["/yoga-stilleri", "/pozlar", "/nasil-calisir", "/sss"]) {
      await expect(menu.locator(`a[href="${href}"]`)).toBeVisible()
    }
    await menu.locator('a[href="/pozlar"]').click()
    await expect(page).toHaveURL(/\/pozlar$/)
  })

  test("pose library: search, category and level filters, detail page with 3D toggle", async ({ page }) => {
    await page.goto("/pozlar")
    const total = await page.getByTestId("pose-card").count()
    expect(total).toBeGreaterThanOrEqual(15)
    // every card has a picture that loaded
    const broken = await page.evaluate(() => [...document.querySelectorAll<HTMLImageElement>("[data-testid=pose-card] img")].filter((i) => i.complete && i.naturalWidth === 0).length)
    expect(broken).toBe(0)

    await page.getByTestId("pose-search").fill("tadasana")
    await expect(page.getByTestId("pose-card")).toHaveCount(1)
    await page.getByTestId("pose-search").fill("zzzz-yok")
    await expect(page.getByTestId("pose-empty")).toBeVisible()
    await page.getByTestId("pose-search").fill("")
    await page.getByTestId("cat-Denge").click()
    const balance = await page.getByTestId("pose-card").count()
    expect(balance).toBeGreaterThan(0)
    expect(balance).toBeLessThan(total)
    await page.getByTestId("cat-all").click()
    await page.getByTestId("level-Orta").click()
    expect(await page.getByTestId("pose-card").count()).toBeLessThan(total)
    await page.getByTestId("level-Orta").click()

    await page.getByTestId("pose-card").first().click()
    await expect(page).toHaveURL(/\/pozlar\/[a-z0-9-]+$/)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(page.getByTestId("pose-image")).toBeVisible()
    await page.getByTestId("pose-3d-toggle").click()
    await expect(page.locator("canvas").first()).toBeAttached({ timeout: 20_000 })
  })

  test("unknown pose and style slugs are 404s", async ({ page }) => {
    expect((await page.goto("/pozlar/yok-boyle-bir-poz"))!.status()).toBe(404)
    expect((await page.goto("/yoga-stilleri/yok"))!.status()).toBe(404)
  })

  test("style pages link to their poses", async ({ page }) => {
    await page.goto("/yoga-stilleri")
    await page.locator("a[href='/yoga-stilleri/vinyasa']").first().click()
    await expect(page.getByRole("heading", { level: 1, name: "Vinyasa" })).toBeVisible()
    const pose = page.locator("a[href^='/pozlar/']").first()
    await expect(pose).toBeVisible()
    await pose.click()
    await expect(page).toHaveURL(/\/pozlar\//)
  })

  test("how it works, FAQ, about and teacher pages render", async ({ page }) => {
    for (const [url, h] of [["/nasil-calisir", /dört adım/i], ["/sss", /./], ["/hakkimizda", /./], ["/ogretmenler-icin", /./]] as const) {
      const res = await page.goto(url)
      expect(res!.status(), url).toBe(200)
      await expect(page.getByRole("heading", { level: 1 })).toContainText(h)
    }
    await page.goto("/sss")
    const items = page.getByTestId("faq-item")
    expect(await items.count()).toBeGreaterThanOrEqual(6)
    await items.first().click()
    await expect(items.first()).toHaveAttribute("open", "")
    // the teachers page states the off-platform rule
    await page.goto("/ogretmenler-icin")
    await expect(page.getByText(/platform dışı|platformun dışına|WhatsApp/i).first()).toBeVisible()
  })

  test("people without a photo get an illustrated portrait, never bare initials", async ({ page }) => {
    await page.goto("/teachers")
    await expect(page.getByTestId("person-avatar").first()).toBeVisible()
    await expect(page.getByTestId("person-avatar").first().locator("text")).toHaveCount(0)
  })
})

test.describe("policy: teachers cannot move students off the platform", () => {
  test("profile editor warns before saving contact details and the admin panel has the violations tab", async ({ browser }) => {
    const t = await makeAccount("TEACHER")
    const a = await makeAccount("ADMIN")
    const ts = await newSession(browser, t.email)
    await ts.page.goto("/teach")
    const bio = ts.page.getByTestId("profile-bio")
    await bio.fill("Merhaba, derslerim için bana instagram: @ayse_yoga hesabından ya da WhatsApp 0532 111 22 33 numarasından ulaşın.")
    await expect(ts.page.getByTestId("profile-bio-warn")).not.toBeEmpty({ timeout: 10_000 })
    await expect(ts.page.getByTestId("profile-save")).toBeDisabled()
    await bio.fill("Sakin ve dikkatli bir akış anlatımı; nefes ve esneklik çalışmalarında yeni başlayanlara eşlik ederim.")
    await expect(ts.page.getByTestId("profile-bio-warn")).toBeEmpty()
    await ts.ctx.close()

    const as = await newSession(browser, a.email)
    await as.page.goto("/admin?tab=policy")
    await expect(as.page.getByTestId("tab-policy")).toBeVisible()
    await as.ctx.close()
  })
})
