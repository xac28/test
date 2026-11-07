import { test, expect, makeAccount, newSession, login } from "./helpers"

// After signing in everybody lands on their own panel — teachers and admins are not sent to the student panel.
test.describe("where people land after signing in", () => {
  for (const [role, path, heading] of [["STUDENT", /\/dashboard$/, "Öğrenci Paneli"], ["TEACHER", /\/teach$/, null], ["ADMIN", /\/admin/, null]] as const) {
    test(`${role}: the login form leads to ${path}`, async ({ page }) => {
      const acc = await makeAccount(role)
      await login(page, acc.email)
      await expect(page).toHaveURL(path, { timeout: 30_000 })
      if (heading) await expect(page.getByText(heading).first()).toBeVisible()
      else await expect(page.getByText("Öğrenci Paneli")).toHaveCount(0)

      // "Panelim" in the header leads to the same place
      await page.goto("/")
      await page.getByTestId("profile-menu-button").click()
      await page.getByRole("menuitem", { name: "Panelim" }).or(page.getByRole("link", { name: "Panelim" })).first().click()
      await expect(page).toHaveURL(path, { timeout: 20_000 })
    })
  }

  test("/panel sends visitors to the login and keeps a deep-link target", async ({ browser, page }) => {
    await page.goto("/panel")
    await expect(page).toHaveURL(/\/login/)
    const t = await makeAccount("TEACHER")
    // an explicit callbackUrl still wins over the role's panel
    await page.goto("/login?callbackUrl=%2Fmessages")
    await page.getByPlaceholder("E-posta adresi").fill(t.email)
    await page.getByPlaceholder("Şifre").fill("Passw0rd!")
    await page.locator("form button[type=submit]").click()
    await expect(page).toHaveURL(/\/messages/, { timeout: 30_000 })

    // a teacher sent to the admin area, and a student sent to the teacher area, end at their own panel
    const { page: tp } = await newSession(browser, t.email)
    await tp.goto("/admin")
    await expect(tp).toHaveURL(/\/teach$/)
    const s = await makeAccount("STUDENT")
    const { page: sp } = await newSession(browser, s.email)
    await sp.goto("/teach")
    await expect(sp).toHaveURL(/\/dashboard$/)
  })
})
