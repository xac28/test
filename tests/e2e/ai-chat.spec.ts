import { test, expect, makeAccount, newSession, db } from "./helpers"
import type { Browser, Page } from "@playwright/test"

// Needs the server started by scripts/run-ai-tests.sh (a fake Anthropic API behind it); skipped on an ordinary server.
const FAKE = process.env.AYA_FAKE_LLM || "http://127.0.0.1:4010"

async function visitor(browser: Browser, viewport = { width: 1440, height: 900 }) {
  const ip = `10.${40 + Math.floor(Math.random() * 100)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`
  const ctx = await browser.newContext({ viewport, extraHTTPHeaders: { "x-forwarded-for": ip } })
  const page = await ctx.newPage()
  const enabled = (await page.request.get("/api/ai/status")).ok() && (await (await page.request.get("/api/ai/status")).json()).enabled
  test.skip(!enabled, "AI is not enabled on this server (run scripts/run-ai-tests.sh)")
  await fetch(`${FAKE}/__reset`).catch(() => {})
  return { ctx, page }
}

async function ask(page: Page, text: string) {
  await page.getByTestId("ai-input").fill(text)
  await page.getByTestId("ai-send").click()
}
const lastAnswer = (page: Page) => page.getByTestId("ai-message").last()

test.describe("AI guide in the browser", () => {
  test("opens with the AI badge, answers with streamed text, result cards and a rating", async ({ browser }) => {
    const { ctx, page } = await visitor(browser)
    await page.goto("/")
    await page.getByTestId("ai-toggle").click()
    await expect(page.getByTestId("ai-badge")).toBeVisible()
    await ask(page, "Yin için bir eğitmen öner")
    const answer = lastAnswer(page)
    await expect(answer).toContainText("Hemen bakıyorum.", { timeout: 20_000 })
    await expect(answer.getByTestId("ai-card").first()).toBeVisible({ timeout: 20_000 })
    await expect(answer).toContainText("En uygun eğitmen")
    await expect(answer.getByTestId("ai-status")).toHaveCount(0) // the "searching…" line is gone once the answer is complete
    const href = await answer.getByTestId("ai-card").first().getAttribute("href")
    expect(href).toMatch(/^\/teachers\//)
    await expect(answer.getByTestId("ai-helpful")).toBeVisible()
    await answer.getByTestId("ai-helpful").click()
    await expect(answer.getByTestId("ai-thanks")).toBeVisible()
    await expect(page.getByTestId("ai-stop")).toHaveCount(0)

    // a card opens its page and closes the chat; the conversation is still there afterwards, even after a reload
    await answer.getByTestId("ai-card").first().click()
    await expect(page).toHaveURL(new RegExp(`${href}$`))
    await expect(page.getByRole("dialog", { name: "AYA yoga rehberi" })).toHaveCount(0)
    await page.reload()
    await page.getByTestId("ai-toggle").click()
    await expect(page.getByTestId("ai-user-message").filter({ hasText: "Yin için bir eğitmen öner" })).toBeVisible()
    await expect(page.getByTestId("ai-card").first()).toBeVisible()
    await page.getByTestId("ai-reset").click()
    await expect(page.getByTestId("ai-user-message")).toHaveCount(0)
    await ctx.close()
  })

  test("shows formatting safely: bold, italics, lists and internal links work; other links and HTML never do", async ({ browser }) => {
    const { ctx, page } = await visitor(browser)
    await page.goto("/")
    await page.getByTestId("ai-toggle").click()
    await ask(page, "__bağlantı")
    const a = lastAnswer(page)
    await expect(a.locator("strong")).toHaveText("kalın")
    await expect(a.locator("em")).toHaveText("eğik")
    await expect(a.locator("li")).toHaveCount(2)
    await expect(a.getByRole("link", { name: "Atölyeler" })).toHaveAttribute("href", "/atolyeler")
    expect(await a.locator("a").count()).toBe(1) // the external and the protocol-relative link stayed plain text
    await expect(a).toContainText("[dış site](https://evil.example/x)")
    await expect(a).toContainText("<img src=x onerror=alert(1)>") // shown as text, not rendered
    expect(await a.locator("img").count()).toBe(0)
    await ctx.close()
  })

  test("the visitor can stop a long answer and keep what was written", async ({ browser }) => {
    const { ctx, page } = await visitor(browser)
    await page.goto("/")
    await page.getByTestId("ai-toggle").click()
    await ask(page, "__yavas")
    await expect(page.getByTestId("ai-stop")).toBeVisible()
    await expect(lastAnswer(page)).toContainText("parça3", { timeout: 15_000 })
    await page.getByTestId("ai-stop").click()
    await expect(page.getByTestId("ai-stop")).toHaveCount(0)
    const kept = await lastAnswer(page).innerText()
    expect(kept).toContain("parça")
    await page.waitForTimeout(800)
    expect(await lastAnswer(page).innerText()).toBe(kept) // nothing more arrives after stopping
    await ask(page, "selam") // and the chat is usable again
    await expect(lastAnswer(page)).toContainText("AYA Rehber", { timeout: 15_000 })
    await ctx.close()
  })

  test("falls back to the rule-based guide when the AI fails, and keeps crisis and human-help answers deterministic", async ({ browser }) => {
    const { ctx, page } = await visitor(browser)
    await page.goto("/")
    await page.getByTestId("ai-toggle").click()
    await ask(page, "__hata Yoga nedir?")
    await expect(page.getByTestId("ai-message")).toHaveCount(2, { timeout: 20_000 }) // welcome + one answer
    const answer = lastAnswer(page)
    await expect(answer).not.toContainText("hata oluştu")
    await expect(answer.getByTestId("ai-card")).toHaveCount(0)
    expect((await answer.innerText()).length).toBeGreaterThan(20)

    await fetch(`${FAKE}/__reset`)
    await ask(page, "Kendime zarar vermek istiyorum")
    await expect(lastAnswer(page)).toContainText("112", { timeout: 20_000 })
    expect(await (await fetch(`${FAKE}/__log`)).json()).toHaveLength(0) // the model never saw it

    await ask(page, "Canlı destekle konuşmak istiyorum")
    await expect(page.getByTestId("mode-support")).toHaveAttribute("aria-selected", "true", { timeout: 20_000 })
    await ctx.close()
  })

  test("opens live support when the AI hands over", async ({ browser }) => {
    const { ctx, page } = await visitor(browser)
    await page.goto("/")
    await page.getByTestId("ai-toggle").click()
    await ask(page, "Bir şikayetim var, iade istiyorum")
    await expect(page.getByTestId("mode-support")).toHaveAttribute("aria-selected", "true", { timeout: 20_000 })
    await page.getByTestId("mode-guide").click()
    await expect(page.getByTestId("ai-message").last()).toContainText("Canlı destek")
    await ctx.close()
  })

  test("a signed-in member gets their own schedule; the chat fits a phone screen", async ({ browser }) => {
    const acc = await makeAccount("STUDENT")
    const s = await newSession(browser, acc.email)
    const enabled = (await (await s.page.request.get("/api/ai/status")).json()).enabled
    test.skip(!enabled, "AI is not enabled on this server")
    await s.page.setViewportSize({ width: 390, height: 780 })
    await s.page.goto("/")
    await s.page.getByTestId("ai-toggle").click()
    await ask(s.page, "Takvimimde ne var?")
    await expect(lastAnswer(s.page)).toContainText("0 ders", { timeout: 20_000 })
    const box = await s.page.getByRole("dialog", { name: "AYA yoga rehberi" }).boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(390)
    expect(await s.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
    await s.ctx.close()
    await db.user.deleteMany({ where: { id: acc.user.id } }).catch(() => {})
  })
  test("the admin AI monitor shows usage, cost and the answers that were given", async ({ browser }) => {
    const { ctx, page } = await visitor(browser)
    await page.goto("/")
    await page.getByTestId("ai-toggle").click()
    await ask(page, "Yin için bir eğitmen öner")
    await expect(lastAnswer(page)).toContainText("En uygun eğitmen", { timeout: 20_000 })
    const admin = await makeAccount("ADMIN")
    const a = await newSession(browser, admin.email)
    await a.page.goto("/admin?tab=ai")
    await a.page.getByRole("tab", { name: "Yapay zekâ" }).click()
    await expect(a.page.getByTestId("ai-llm")).toBeVisible({ timeout: 15_000 })
    await expect(a.page.getByTestId("ai-llm-off")).toHaveCount(0)
    await expect(a.page.getByTestId("ai-llm-row").first()).toBeVisible()
    await expect(a.page.getByTestId("ai-tools-used")).toContainText("search_teachers")
    await a.page.screenshot({ path: "test-results/admin-ai-llm.png", fullPage: true })
    await a.ctx.close(); await ctx.close()
  })
})
