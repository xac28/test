import { test, expect, makeAccount, newSession, db } from "./helpers"
import type { Browser, Page } from "@playwright/test"

// The guide is our own engine, so these tests drive the real widget against the real server and database.

async function visitor(browser: Browser, viewport = { width: 1440, height: 900 }) {
  const ip = `10.${40 + Math.floor(Math.random() * 100)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`
  const ctx = await browser.newContext({ viewport, extraHTTPHeaders: { "x-forwarded-for": ip } })
  return { ctx, page: await ctx.newPage() }
}

async function ask(page: Page, text: string) {
  await page.getByTestId("ai-input").fill(text)
  await page.getByTestId("ai-send").click()
}
const lastAnswer = (page: Page) => page.getByTestId("ai-message").last()
/** The answer is complete when the stop button is gone again. */
const settled = (page: Page) => expect(page.getByTestId("ai-stop")).toHaveCount(0, { timeout: 20_000 })

test.describe("AYA Rehber in the browser", () => {
  test("opens with the badge, understands a complaint and answers with advice, cards, links and chips", async ({ browser }) => {
    const { ctx, page } = await visitor(browser)
    await page.goto("/")
    await page.getByTestId("ai-toggle").click()
    await expect(page.getByTestId("ai-badge")).toBeVisible()
    await page.getByRole("button", { name: "Bel ağrım için ne yapabilirim?" }).click()
    const answer = lastAnswer(page)
    await expect(answer).toContainText("Uygun stiller", { timeout: 20_000 })
    await settled(page)
    await expect(answer).toContainText("Denenecek duruşlar")
    await expect(answer.getByTestId("ai-status")).toHaveCount(0) // the "searching…" line is gone once the answer is there
    const cards = answer.getByTestId("ai-card")
    expect(await cards.count()).toBeGreaterThanOrEqual(2)
    expect(await cards.evaluateAll((els) => els.map((e) => e.getAttribute("href")))).toEqual(expect.arrayContaining([expect.stringMatching(/^\/pozlar\//), expect.stringMatching(/^\/teachers\//)]))
    await expect(answer.getByTestId("ai-link").first()).toBeVisible()
    await expect(answer.getByTestId("ai-suggestions").getByRole("button").first()).toBeVisible()
    await expect(answer.getByTestId("ai-helpful")).toBeVisible()
    await answer.getByTestId("ai-helpful").click()
    await expect(answer.getByTestId("ai-thanks")).toBeVisible()
    await page.screenshot({ path: "test-results/ai-need.png" })
    // a pose card leads to the pose page
    await answer.locator('[data-testid=ai-card][href^="/pozlar/"]').first().click()
    await expect(page).toHaveURL(/\/pozlar\/[a-z0-9-]+$/)
    await ctx.close()
  })

  test("remembers what was said: chips and short follow-ups continue the same pose", async ({ browser }) => {
    const { ctx, page } = await visitor(browser)
    await page.goto("/")
    await page.getByTestId("ai-toggle").click()
    await ask(page, "çocuk pozu nasıl yapılır")
    await expect(lastAnswer(page)).toContainText("Adım adım", { timeout: 20_000 })
    await settled(page)
    await lastAnswer(page).getByTestId("ai-suggestions").getByRole("button", { name: "Daha kolay hali" }).click()
    await expect(lastAnswer(page)).toContainText("Daha kolay hali:", { timeout: 20_000 })
    await expect(lastAnswer(page)).toContainText("Çocuk Pozu")
    await settled(page)
    await ask(page, "kimler yapmamalı")
    await expect(lastAnswer(page)).toContainText("Dikkat etmen gerekenler", { timeout: 20_000 })
    await expect(lastAnswer(page)).toContainText("Çocuk Pozu")
    await page.screenshot({ path: "test-results/ai-memory.png" })
    await ctx.close()
  })

  test("builds a routine and a weekly plan, and compares styles", async ({ browser }) => {
    const { ctx, page } = await visitor(browser)
    await page.goto("/")
    await page.getByTestId("ai-toggle").click()
    await ask(page, "10 dakikalık sabah rutini hazırla")
    await expect(lastAnswer(page)).toContainText("dakikalık", { timeout: 20_000 })
    await expect(lastAnswer(page)).toContainText("Savasana")
    await settled(page)
    await ask(page, "hatha mı vinyasa mı")
    await expect(lastAnswer(page)).toContainText("yoğunluk", { timeout: 20_000 })
    await settled(page)
    await page.screenshot({ path: "test-results/ai-routine.png" })
    await ctx.close()
  })

  test("the visitor can stop an answer that is being written and keep what was written", async ({ browser }) => {
    const { ctx, page } = await visitor(browser)
    await page.goto("/")
    await page.getByTestId("ai-toggle").click()
    await ask(page, "hamileyim hangi yoga yapabilirim")
    await expect(page.getByTestId("ai-stop")).toBeVisible({ timeout: 10_000 })
    await page.getByTestId("ai-stop").click()
    await settled(page)
    await expect(lastAnswer(page)).not.toHaveText("")
    // the next question works as usual
    await ask(page, "merhaba")
    await expect(lastAnswer(page)).toContainText("AYA Rehber", { timeout: 20_000 })
    await ctx.close()
  })

  test("the chat survives a reload of the tab, and 'Yeni sohbet' clears it", async ({ browser }) => {
    const { ctx, page } = await visitor(browser)
    await page.goto("/")
    await page.getByTestId("ai-toggle").click()
    await ask(page, "kimsin sen")
    await expect(lastAnswer(page)).toContainText("AYA Rehber", { timeout: 20_000 })
    await settled(page)
    await page.reload()
    await page.getByTestId("ai-toggle").click()
    await expect(page.getByTestId("ai-user-message").last()).toContainText("kimsin sen")
    await page.getByTestId("ai-reset").click()
    await expect(page.getByTestId("ai-user-message")).toHaveCount(0)
    await ctx.close()
  })

  test("shows formatting safely: bold and internal links work; other links and HTML never do", async ({ browser }) => {
    const key = `zxq${Math.random().toString(36).slice(2, 8)}`
    const row = await db.aiTaughtAnswer.create({
      data: { question: `${key} biçim`, keys: JSON.stringify([`${key} biçim`]), answer: "**Kalın** metin, [Fiyatlar](/pricing), [dış site](https://evil.example/x), [mutlak](//evil.example) ve <img src=x onerror=alert(1)> ile\n\n- birinci madde\n- ikinci madde" },
    })
    const { ctx, page } = await visitor(browser)
    let dialogs = 0
    page.on("dialog", (d) => { dialogs++; d.dismiss() })
    try {
      await page.goto("/")
      await page.getByTestId("ai-toggle").click()
      await ask(page, `${key} biçim nedir`)
      const a = lastAnswer(page)
      await expect(a).toContainText("Kalın metin", { timeout: 20_000 })
      await settled(page)
      await expect(a.locator("strong")).toContainText("Kalın")
      await expect(a.getByRole("link", { name: "Fiyatlar" })).toHaveAttribute("href", "/pricing")
      await expect(a.locator('a[href*="evil.example"]')).toHaveCount(0)
      await expect(a.locator("img")).toHaveCount(0)
      await expect(a.getByRole("listitem")).toHaveCount(2)
      await expect(a).toContainText("<img src=x onerror=alert(1)>") // shown as text
      expect(dialogs).toBe(0)
    } finally {
      await ctx.close()
      await db.aiTaughtAnswer.delete({ where: { id: row.id } }).catch(() => {})
    }
  })

  test("opens live support when asked, and answers a member from their own schedule on a phone", async ({ browser }) => {
    const acc = await makeAccount("STUDENT")
    const s = await newSession(browser, acc.email)
    await s.page.setViewportSize({ width: 390, height: 780 })
    await s.page.goto("/")
    await s.page.getByTestId("ai-toggle").click()
    await ask(s.page, "takvimimde ne var")
    await expect(lastAnswer(s.page)).toContainText("yok", { timeout: 20_000 })
    await settled(s.page)
    const box = await s.page.getByRole("dialog", { name: "AYA yoga rehberi" }).boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(390)
    expect(await s.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
    await ask(s.page, "canlı destekle konuşmak istiyorum")
    await expect(s.page.getByTestId("mode-support")).toHaveAttribute("aria-selected", "true", { timeout: 20_000 })
    await s.ctx.close()
    await db.user.deleteMany({ where: { id: acc.user.id } }).catch(() => {})
  })

  test("the admin sees what was asked, what the guide said and how sure it was", async ({ browser }) => {
    const { ctx, page } = await visitor(browser)
    await page.goto("/")
    await page.getByTestId("ai-toggle").click()
    const q = `bel ağrım için ne yapabilirim ${Math.random().toString(36).slice(2, 6)}`
    await ask(page, q)
    await expect(lastAnswer(page)).toContainText("Uygun stiller", { timeout: 20_000 })
    await settled(page)
    const admin = await makeAccount("ADMIN")
    const a = await newSession(browser, admin.email)
    await a.page.goto("/admin?tab=ai")
    await a.page.getByRole("tab", { name: "Rehber analizi" }).click()
    await expect(a.page.getByTestId("ai-llm")).toBeVisible({ timeout: 15_000 })
    await a.page.getByTestId("ai-llm-search").fill(q.slice(0, 20))
    await expect(a.page.getByTestId("ai-llm-row").first()).toBeVisible()
    await expect(a.page.getByTestId("ai-tools-used")).toContainText("search_teachers")
    await a.page.screenshot({ path: "test-results/admin-ai-llm.png", fullPage: true })
    await a.ctx.close(); await ctx.close()
    await db.aiInteraction.deleteMany({ where: { message: q } }).catch(() => {})
  })
})
