import { test, expect, makeAccount, db } from "./helpers"
import type { Page } from "@playwright/test"

async function ask(page: Page, text: string) {
  const before = await page.getByTestId("ai-message").count()
  await page.getByTestId("ai-input").fill(text)
  await page.getByTestId("ai-send").click()
  await expect(page.getByTestId("ai-message")).toHaveCount(before + 1, { timeout: 20_000 })
  return page.getByTestId("ai-message").last()
}

test.describe("AYA Rehber (chat guide)", () => {
  test("opens, answers and routes visitors to the right pages", async ({ page }) => {
    await page.goto("/")
    await page.getByTestId("ai-toggle").click()
    await expect(page.getByRole("dialog", { name: /rehber/i })).toBeVisible()
    await expect(page.getByTestId("ai-message").first()).toContainText("AYA Rehber")

    // quick prompt
    await page.getByRole("button", { name: "Eğitmen olmak istiyorum" }).click()
    const msg = page.getByTestId("ai-message").last()
    await expect(msg).toContainText("başvuru", { timeout: 20_000 })
    await msg.getByTestId("ai-link").first().click({ timeout: 20_000 })
    await expect(page).toHaveURL(/\/become-teacher$/)
    await expect(page.getByRole("heading", { level: 1 })).toContainText("paylaş")

    // sign-up routing (the panel closed on navigation; open it again)
    await page.getByTestId("ai-toggle").click()
    const reg = await ask(page, "Üye olmak istiyorum")
    await expect(reg).toContainText("ücretsiz")
    await reg.getByTestId("ai-link").first().click()
    await expect(page).toHaveURL(/\/login\?mode=register$/)
  })

  test("teacher advice links to a working profile page (database teacher)", async ({ page }) => {
    await db.teacher.updateMany({ where: { hourlyRate: { lte: 1 } }, data: { hourlyRate: 40 } }) // leftovers of earlier runs must not outrank this one
    const t = await makeAccount("TEACHER", { name: `Rehber Hoca ${Math.random().toString(36).slice(2, 6)}` })
    await db.teacher.update({ where: { id: t.teacher!.id }, data: { hourlyRate: 1, specialties: JSON.stringify(["Yin Yoga"]), bio: "Yin yoga ile derin esneme." } })
    await db.availability.createMany({ data: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ teacherId: t.teacher!.id, dayOfWeek: d, startTime: "09:00", endTime: "12:00" })) })

    await page.goto("/")
    await page.getByTestId("ai-toggle").click()
    const msg = await ask(page, "ucuz yin yoga esneme hocası öner")
    const card = msg.locator(`a[href="/teachers/${t.teacher!.id}"]`)
    await expect(card).toBeVisible()
    await card.click()
    await expect(page).toHaveURL(new RegExp(`/teachers/${t.teacher!.id}$`))
    await expect(page.getByRole("heading", { level: 1 })).toContainText(t.user.name!, { timeout: 20_000 })
    // real availability is bookable from the profile
    await expect(page.getByText("Yin yoga ile derin esneme.").first()).toBeVisible()
  })

  test("typed HTML is shown as text, never executed", async ({ page }) => {
    let dialogs = 0
    page.on("dialog", (d) => { dialogs++; d.dismiss() })
    await page.goto("/")
    await page.getByTestId("ai-toggle").click()
    await page.getByTestId("ai-input").fill("<img src=x onerror=alert(1)> merhaba")
    await page.getByTestId("ai-send").click()
    await expect(page.getByTestId("ai-user-message").last()).toContainText("<img src=x")
    await expect(page.getByTestId("ai-message")).toHaveCount(2, { timeout: 20_000 })
    expect(dialogs).toBe(0)
    expect(await page.locator("[data-testid=ai-user-message] img").count()).toBe(0)
  })

  test("teacher profile pages render (demo and unknown ids)", async ({ page }) => {
    await page.goto("/teachers/aylin-demir")
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Aylin Demir")
    await page.goto("/teachers/no-such-teacher")
    await expect(page.getByRole("heading", { name: "Eğitmen bulunamadı" })).toBeVisible({ timeout: 15_000 })
  })
})
