import { test, expect, makeAccount, newSession, db, confirmDialog } from "./helpers"
import type { Page } from "@playwright/test"

const rnd = () => Math.random().toString(36).slice(2, 8).replace(/\d/g, "q")

async function ask(page: Page, text: string) {
  const before = await page.getByTestId("ai-message").count()
  await page.getByTestId("ai-input").fill(text)
  await page.getByTestId("ai-send").click()
  await expect(page.getByTestId("ai-message")).toHaveCount(before + 1, { timeout: 15_000 })
  return page.getByTestId("ai-message").last()
}

test.describe("AYA Rehber: learning, feedback, live support", () => {
  test("unknown question → recorded; admin teaches it; the guide then answers; thumbs-down escalates to live support and an admin answers", async ({ browser }) => {
    const student = await makeAccount("STUDENT", { name: "Selin Öğrenci" })
    const admin = await makeAccount("ADMIN")
    const s = await newSession(browser, student.email)
    const a = await newSession(browser, admin.email)
    const w1 = rnd(), w2 = rnd(), w3 = rnd()
    const question = `${w1} ${w2} ${w3}`

    // ── the guide does not know → says it will learn
    await s.page.goto("/")
    await s.page.getByTestId("ai-toggle").click()
    const unknown = await ask(s.page, question)
    await expect(unknown).toContainText("öğreneceğim")
    await expect(s.page.getByTestId("ai-learning")).toBeVisible()
    await s.page.screenshot({ path: "test-results/ai-unknown.png" })

    // ── admin: unknown queue → teach
    await a.page.goto("/admin?tab=ai")
    await expect(a.page.getByTestId("ai-overview")).toBeVisible()
    await a.page.getByTestId("ai-view-unknown").click()
    await a.page.getByTestId("ai-unknown-search").fill(w1)
    const row = a.page.getByTestId("ai-unknown-row").filter({ hasText: w1 })
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.getByTestId("ai-teach").click()
    await expect(a.page.getByTestId("teach-question")).toHaveValue(new RegExp(w1))
    await a.page.getByTestId("teach-answer").fill(`**${w1}** için yanıt: Bu bir öğretilmiş cevaptır, ödemeyi paketler sayfasında yaparsın.`)
    await a.page.getByTestId("teach-href").fill("javascript:alert(1)")
    await a.page.getByTestId("teach-save").click()
    await expect(a.page.getByTestId("teach-error")).toContainText("Bağlantı")
    await a.page.getByTestId("teach-href").fill("/pricing")
    await a.page.screenshot({ path: "test-results/ai-teach.png" })
    await a.page.getByTestId("teach-save").click()
    await expect(a.page.getByTestId("toast")).toContainText("öğretildi", { ignoreCase: true })
    await expect(a.page.getByTestId("ai-unknown-row").filter({ hasText: w1 })).toHaveCount(0)
    await a.page.getByTestId("ai-view-taught").click()
    await expect(a.page.getByTestId("ai-taught-row").filter({ hasText: w1 })).toBeVisible()

    // ── the guide now answers it (with the link) and the asker got a notification
    const taught = await ask(s.page, `${question} acaba`)
    await expect(taught).toContainText("öğretilmiş cevaptır")
    await expect(taught.getByTestId("ai-link").first()).toHaveAttribute("href", "/pricing")
    await taught.getByTestId("ai-helpful").click()
    await expect(taught.getByTestId("ai-thanks")).toBeVisible()
    expect(await db.notification.count({ where: { userId: student.user.id, title: "Sorduğun soruya cevap ekledik" } })).toBe(1)

    // ── thumbs-down on a built-in answer → escalate
    const yoga = await ask(s.page, "Yoga nedir?")
    await yoga.getByTestId("ai-unhelpful").click()
    await expect(yoga.getByTestId("ai-escalate")).toBeVisible()
    await s.page.screenshot({ path: "test-results/ai-escalate.png" })
    await yoga.getByTestId("ai-to-support").click()
    await expect(s.page.getByTestId("support-chat")).toBeVisible()
    await s.page.getByTestId("support-input").fill("Yoga nedir sorusuna verilen cevap yetersiz, ders paketlerini karşılaştırmak istiyorum.")
    await s.page.getByTestId("support-send").click()
    await expect(s.page.getByTestId("support-user-msg")).toHaveCount(1)
    await expect(s.page.getByTestId("support-waiting")).toBeVisible()
    await expect(s.page.getByTestId("support-system").first()).toContainText("yardımcı olamadı")
    await s.page.screenshot({ path: "test-results/support-user.png" })

    // ── admin sees the badge + queue, replies with a canned text
    await a.page.goto("/admin")
    await expect(a.page.getByTestId("nav-support")).toContainText(/\d/)
    await a.page.getByTestId("nav-support").click()
    await expect(a.page.getByTestId("tab-support")).toBeVisible()
    await a.page.getByTestId("support-search").fill(student.email)
    await a.page.getByTestId("support-row").filter({ hasText: "Yoga nedir" }).click()
    const drawer = a.page.getByTestId("support-drawer")
    await expect(drawer.getByTestId("thread-user")).toContainText("yetersiz")
    await drawer.getByTestId("support-canned").selectOption({ index: 1 })
    await expect(drawer.getByTestId("support-reply")).not.toHaveValue("")
    await drawer.getByTestId("support-note-toggle").check()
    await drawer.getByTestId("support-reply").fill("Üyenin son sorusu bilgi tabanında eksik, Rehber'e öğretilecek.")
    await drawer.getByTestId("support-send-reply").click()
    await expect(drawer.getByTestId("thread-note")).toBeVisible()
    await drawer.getByTestId("support-note-toggle").uncheck()
    await drawer.getByTestId("support-reply").fill("Merhaba Selin, paket karşılaştırmasını birlikte yapalım: hangi sıklıkta ders düşünüyorsun?")
    await drawer.getByTestId("support-send-reply").click()
    await expect(drawer.getByTestId("thread-staff")).toBeVisible()
    await a.page.screenshot({ path: "test-results/support-admin.png" })

    // ── the member sees the reply without reloading (polling) and the note stays private
    await expect(s.page.getByTestId("support-staff-msg")).toContainText("paket karşılaştırmasını", { timeout: 15_000 })
    await expect(s.page.getByTestId("support-chat")).not.toContainText("bilgi tabanında eksik")
    await s.page.screenshot({ path: "test-results/support-reply.png" })

    // ── admin closes → member rates
    await drawer.getByTestId("support-close-ticket").click()
    await expect(s.page.getByTestId("support-closed")).toBeVisible({ timeout: 15_000 })
    await s.page.getByTestId("support-star-5").click()
    await expect(s.page.getByTestId("support-thanks")).toBeVisible()
    expect((await db.supportTicket.findFirstOrThrow({ where: { userId: student.user.id } })).rating).toBe(5)

    // ── history page and bell
    await s.page.goto("/dashboard/support")
    await expect(s.page.getByTestId("support-history")).toContainText("Yoga nedir")
    await expect(s.page.getByTestId("bell")).toBeVisible()

    await s.ctx.close(); await a.ctx.close()
  })

  test("typing 'canlı destek' opens live support; signed-out visitors are asked to sign in", async ({ page, browser }) => {
    await page.goto("/")
    await page.getByTestId("ai-toggle").click()
    await page.getByTestId("ai-input").fill("canlı destek istiyorum")
    await page.getByTestId("ai-send").click()
    await expect(page.getByTestId("support-login")).toBeVisible({ timeout: 15_000 })
    await page.screenshot({ path: "test-results/support-login.png" })

    const u = await makeAccount("STUDENT")
    const s = await newSession(browser, u.email)
    await s.page.goto("/")
    await s.page.getByTestId("ai-toggle").click()
    await s.page.getByTestId("ai-input").fill("yetkili biriyle konuşmak istiyorum")
    await s.page.getByTestId("ai-send").click()
    await expect(s.page.getByTestId("support-chat")).toBeVisible({ timeout: 15_000 })
    await s.page.getByTestId("mode-guide").click()
    await expect(s.page.getByTestId("ai-input")).toBeVisible()
    await s.ctx.close()
  })

  test("admin panel: reviews, logs and the new overview shortcuts work", async ({ browser }) => {
    const admin = await makeAccount("ADMIN")
    const a = await newSession(browser, admin.email)
    await a.page.goto("/admin")
    await expect(a.page.getByTestId("queue-support-all")).toBeVisible()
    await a.page.getByTestId("queue-ai-all").click()
    await expect(a.page).toHaveURL(/tab=ai/)
    await expect(a.page.getByTestId("tab-ai")).toBeVisible()

    await a.page.getByTestId("nav-reviews").click()
    await expect(a.page.getByTestId("tab-reviews")).toBeVisible()
    await a.page.getByTestId("review-reported").check()
    await a.page.getByTestId("review-reported").uncheck()

    await a.page.getByTestId("nav-audit").click()
    await expect(a.page.getByTestId("log-events")).toBeVisible()
    await expect(a.page.getByTestId("log-chart")).toBeVisible()
    await a.page.getByTestId("log-type").selectOption("AUTH_LOGIN")
    await a.page.getByTestId("log-search").fill(admin.email)
    const rows = a.page.getByTestId("log-row")
    await expect(rows.first()).toContainText("Giriş yapıldı", { timeout: 15_000 })
    await a.page.getByTestId("log-live").check()
    await a.page.screenshot({ path: "test-results/admin-logs.png", fullPage: true })
    await a.page.getByTestId("log-view-admin").click()
    await expect(a.page.getByTestId("log-admin")).toBeVisible()
    await a.page.getByTestId("audit-group").selectOption("SUPPORT")
    await a.ctx.close()
  })
})
