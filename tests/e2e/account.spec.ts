import { test, expect, makeAccount, newSession, login, db } from "./helpers"
import crypto from "crypto"

const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex")

test.describe("forgot and reset password", () => {
  test("the login page links to it; asking for a link shows the same message for any address", async ({ page }) => {
    await page.goto("/login")
    await page.getByTestId("forgot-link").click()
    await expect(page).toHaveURL(/\/forgot-password$/)
    await page.getByTestId("forgot-email").fill(`kimse-${Date.now()}@aya.test`)
    await page.getByTestId("forgot-submit").click()
    await expect(page.getByTestId("forgot-sent")).toBeVisible()
  })

  test("a valid link sets a new password, then the old one stops working and the link is spent", async ({ page, browser }) => {
    const a = await makeAccount("STUDENT")
    const token = crypto.randomBytes(32).toString("hex")
    await db.passwordResetToken.create({ data: { userId: a.user.id, tokenHash: hash(token), expiresAt: new Date(Date.now() + 3_600_000) } })

    await page.goto(`/reset-password?token=${token}`)
    await expect(page.getByTestId("reset-form")).toBeVisible()
    await page.getByTestId("reset-password").fill("Yeni-Sifre1!")
    await page.getByTestId("reset-again").fill("Baska-Sifre1!")
    await page.getByTestId("reset-submit").click()
    await expect(page.getByTestId("reset-error")).toContainText("aynısı")
    await page.getByTestId("reset-again").fill("Yeni-Sifre1!")
    await page.getByTestId("reset-submit").click()
    await expect(page.getByTestId("reset-done")).toBeVisible()

    // the new password signs in
    await page.getByTestId("reset-login").click()
    await login(page, a.email, "Yeni-Sifre1!")
    await expect(page).not.toHaveURL(/\/login/)

    // the old password does not, and the link cannot be used twice
    const ctx = await browser.newContext()
    const p2 = await ctx.newPage()
    await p2.goto("/login")
    await p2.getByPlaceholder("E-posta adresi").fill(a.email)
    await p2.getByPlaceholder("Şifre").fill("Passw0rd!")
    await p2.locator("form button[type=submit]").click()
    await expect(p2).toHaveURL(/\/login/)
    await p2.goto(`/reset-password?token=${token}`)
    await expect(p2.getByTestId("reset-invalid")).toBeVisible()
    await ctx.close()
  })

  test("a missing or made-up link explains itself and offers a new one", async ({ page }) => {
    await page.goto("/reset-password")
    await expect(page.getByTestId("reset-invalid")).toBeVisible()
    await page.goto(`/reset-password?token=${crypto.randomBytes(32).toString("hex")}`)
    await expect(page.getByTestId("reset-invalid")).toBeVisible()
    await page.getByRole("link", { name: "Yeni bağlantı iste" }).click()
    await expect(page).toHaveURL(/\/forgot-password$/)
  })
})

test.describe("my data and closing the account", () => {
  test("download the data, see what blocks deletion, then delete and be signed out", async ({ browser }) => {
    const a = await makeAccount("STUDENT")
    const s = await newSession(browser, a.email)
    await s.page.goto("/dashboard/profile")
    await expect(s.page.getByTestId("account-data")).toBeVisible()

    const [download] = await Promise.all([s.page.waitForEvent("download"), s.page.getByTestId("export-data").click()])
    expect(download.suggestedFilename()).toBe("aya-verilerim.json")

    await s.page.getByTestId("delete-open").click()
    await expect(s.page.getByTestId("delete-panel")).toBeVisible()
    const confirm = s.page.getByTestId("delete-confirm")
    await expect(confirm).toBeDisabled()
    await s.page.getByTestId("delete-password").fill(a.password)
    await s.page.getByTestId("delete-phrase").fill("hesabimi sil")
    await expect(confirm).toBeDisabled() // the phrase must match exactly
    await s.page.getByTestId("delete-phrase").fill("HESABIMI SİL")
    await expect(confirm).toBeEnabled()
    await confirm.click()
    await s.page.waitForURL((u) => u.pathname === "/", { timeout: 30_000 })
    const row = await db.user.findUniqueOrThrow({ where: { id: a.user.id } })
    expect(row.deletedAt).not.toBeNull()
    await s.ctx.close()
  })
})

test.describe("not found and plumbing", () => {
  test("an unknown address gets the designed 404 page with ways forward", async ({ page }) => {
    const res = await page.goto("/bu-sayfa-yok")
    expect(res!.status()).toBe(404)
    await expect(page.getByTestId("not-found")).toBeVisible()
    await expect(page.getByRole("link", { name: "Pozlara bak" })).toBeVisible()
    await page.getByRole("link", { name: "Ana sayfaya dön" }).click()
    await expect(page).toHaveURL(/\/$/)
  })

  test("pages carry their own titles, a canonical link and structured data", async ({ page }) => {
    await page.goto("/pozlar/agac")
    await expect(page).toHaveTitle(/Ağaç/)
    expect(await page.locator("link[rel=canonical]").getAttribute("href")).toMatch(/\/pozlar\/agac$/)
    const ld = await page.locator("script[type='application/ld+json']").first().textContent()
    expect(JSON.parse(ld!)["@type"]).toBe("HowTo")
    await page.goto("/yoga-stilleri/yin")
    expect(JSON.parse((await page.locator("script[type='application/ld+json']").first().textContent())!)["@type"]).toBe("FAQPage")
    await page.goto("/")
    expect(await page.locator("meta[property='og:site_name']").getAttribute("content")).toBe("AYA")
    expect(await page.locator("meta[property='og:image']").count()).toBeGreaterThan(0)
    await page.goto("/login")
    expect(await page.locator("meta[name=robots]").getAttribute("content")).toContain("noindex")
  })

  test("the skip link is the first tab stop and moves focus to the content", async ({ page }) => {
    await page.goto("/sss")
    await page.keyboard.press("Tab")
    const skip = page.getByRole("link", { name: "İçeriğe geç" })
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible()
    await page.keyboard.press("Enter")
    await expect(page.locator("main")).toBeFocused()
  })
})
