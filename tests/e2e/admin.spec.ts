import { test, expect, makeAccount, newSession, db, confirmDialog } from "./helpers"
import type { Page } from "@playwright/test"

const uid = () => Math.random().toString(36).slice(2, 7)

async function fileReport(page: Page, opts: { open: string; category: string; text: string }) {
  await page.getByTestId(opts.open).click()
  const dlg = page.getByTestId("report-dialog")
  await expect(dlg).toBeVisible()
  await expect(dlg.getByTestId("report-submit")).toBeDisabled() // nothing chosen yet
  await dlg.getByTestId(`report-cat-${opts.category}`).check()
  await dlg.getByTestId("report-description").fill("kısa")
  await expect(dlg.getByTestId("report-submit")).toBeDisabled() // description too short
  await dlg.getByTestId("report-description").fill(opts.text)
  await dlg.getByTestId("report-submit").click()
  await expect(dlg.getByTestId("report-done")).toBeVisible({ timeout: 15_000 })
  await dlg.getByRole("button", { name: "Tamam" }).click()
  await expect(dlg).toHaveCount(0)
}

test.describe("admin panel navigation", () => {
  test("the URL drives the tab: sidebar, back button, unknown tabs, mobile tab bar", async ({ browser }) => {
    const admin = await makeAccount("ADMIN")
    const a = await newSession(browser, admin.email)
    await a.page.goto("/admin")
    await expect(a.page.getByTestId("tab-overview")).toBeVisible()
    await expect(a.page.getByTestId("health")).toContainText("Veritabanı")
    await expect(a.page.getByTestId("nav-overview")).toHaveAttribute("aria-current", "page")

    for (const [id, marker] of [["reports", "tab-reports"], ["users", "tab-users"], ["bookings", "tab-bookings"], ["workshops", "tab-workshops"], ["recordings", "tab-recordings"], ["security", "tab-security"], ["audit", "tab-audit"], ["rooms", "tab-rooms"]]) {
      await a.page.getByTestId(`nav-${id}`).click()
      await expect(a.page).toHaveURL(new RegExp(`tab=${id}$`))
      await expect(a.page.getByTestId(marker)).toBeVisible({ timeout: 15_000 })
      await expect(a.page.getByTestId(`nav-${id}`)).toHaveAttribute("aria-current", "page")
    }
    await a.page.goBack()
    await expect(a.page.getByTestId("tab-audit")).toBeVisible() // back navigation restores the previous tab (not a stale state)
    await expect(a.page).toHaveURL(/tab=audit$/)
    await a.page.reload()
    await expect(a.page.getByTestId("tab-audit")).toBeVisible() // reload keeps the tab

    await a.page.goto("/admin?tab=does-not-exist")
    await expect(a.page.getByTestId("tab-overview")).toBeVisible()

    // overview shortcuts jump to the right tab
    await a.page.getByTestId("queue-reports-all").click()
    await expect(a.page).toHaveURL(/tab=reports/)

    // phones get a horizontal tab bar instead of the sidebar
    await a.page.setViewportSize({ width: 390, height: 800 })
    await a.page.goto("/admin")
    const bar = a.page.getByTestId("admin-tabbar")
    await expect(bar).toBeVisible()
    await bar.getByRole("button", { name: /Kullanıcılar/ }).click()
    await expect(a.page).toHaveURL(/tab=users/)
    await expect(a.page.getByTestId("tab-users")).toBeVisible()
    expect(await a.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true) // no horizontal page scroll
    await a.ctx.close()
  })

  test("non-admins never see the panel", async ({ browser }) => {
    const s = await newSession(browser, (await makeAccount("STUDENT")).email)
    await s.page.goto("/admin?tab=reports")
    await expect(s.page).toHaveURL(/\/dashboard/)
    const res = await s.page.request.get("/api/admin/reports")
    expect([401, 403]).toContain(res.status())
    await s.ctx.close()
  })
})

test.describe("reports end to end", () => {
  test("student reports a workshop; the admin takes it down; the student sees the outcome without internal notes", async ({ browser }) => {
    const tag = uid()
    const teacher = await makeAccount("TEACHER", { name: `Rapor Hoca ${tag}` })
    const student = await makeAccount("STUDENT", { name: `Rapor Öğrenci ${tag}` })
    const admin = await makeAccount("ADMIN")
    const ws = await db.workshop.create({
      data: { slug: `rapor-${tag}`, title: `Şüpheli Atölye ${tag}`, description: "Açıklama " + "x".repeat(40), category: "Hatha", mode: "LIVE", status: "PUBLISHED", teacherId: teacher.teacher!.id, startsAt: new Date(Date.now() + 86_400_000), capacity: 5 },
    })

    const s = await newSession(browser, student.email)
    await s.page.goto(`/atolyeler/rapor-${tag}`)
    await fileReport(s.page, { open: "report-open-workshop", category: "FRAUD", text: "Atölye açıklaması gerçeği yansıtmıyor, platform dışına ödeme istiyorlar." })
    expect(await db.report.count({ where: { reporterId: student.user.id, targetType: "WORKSHOP", targetId: ws.id } })).toBe(1)

    // the same report cannot be filed twice
    await s.page.getByTestId("report-open-workshop").click()
    await s.page.getByTestId("report-cat-SAFETY").check()
    await s.page.getByTestId("report-description").fill("Bunu daha önce de bildirmiştim ama yine yazıyorum.")
    await s.page.getByTestId("report-submit").click()
    await expect(s.page.getByTestId("report-error")).toContainText("zaten bildirdiniz")
    await s.page.keyboard.press("Escape")

    await s.page.goto("/dashboard/reports")
    const mine = s.page.getByTestId("my-report")
    await expect(mine).toHaveCount(1)
    await expect(mine).toContainText("Yeni")
    await expect(mine).toContainText("Bildiriminiz alındı")

    // ── admin ──
    const a = await newSession(browser, admin.email)
    await a.page.goto("/admin?tab=reports")
    await a.page.getByTestId("report-search").fill(teacher.user.email!)
    const row = a.page.getByTestId("report-row")
    await expect(row).toHaveCount(1, { timeout: 15_000 })
    await expect(row).toContainText("Aldatma")
    await expect(row).toContainText("Yüksek")
    await row.click()
    const drawer = a.page.getByTestId("report-drawer")
    await expect(drawer.getByTestId("report-reason")).toContainText("platform dışına ödeme")
    await expect(drawer).toContainText(`Şüpheli Atölye ${tag}`)

    await drawer.getByTestId("mark-reviewed").click()
    await drawer.getByTestId("admin-note").fill("İç not: eğitmenle görüşülecek")
    await drawer.getByTestId("save-note").click()
    await expect(drawer.getByTestId("save-note")).toBeDisabled({ timeout: 10_000 })

    await drawer.getByTestId("act-unpublish").click()
    await expect(a.page.getByTestId("confirm-ok")).toBeEnabled()
    await confirmDialog(a.page, "Yanıltıcı içerik")
    await expect(drawer.getByTestId("report-closed-info")).toContainText("Atölye yayından kaldırıldı", { timeout: 15_000 })
    await expect(drawer.getByTestId("act-unpublish")).toHaveCount(0) // closed reports offer no sanctions
    expect((await db.workshop.findUniqueOrThrow({ where: { id: ws.id } })).status).toBe("DRAFT")

    // student: outcome visible, internal note and sanction details hidden
    await s.page.reload()
    await expect(s.page.getByTestId("my-report")).toContainText("Sonuçlandı")
    await expect(s.page.getByTestId("my-report")).toContainText("gerekli işlem yapıldı")
    const text = await s.page.locator("body").innerText()
    expect(text).not.toContain("İç not")
    expect(text).not.toContain("yayından kaldırıldı")

    // closed reports show under "Sonuçlandı" and can be re-opened
    await a.page.keyboard.press("Escape")
    await a.page.getByTestId("report-status-RESOLVED").click()
    await expect(a.page.getByTestId("report-row")).toHaveCount(1, { timeout: 15_000 })
    await a.page.getByTestId("report-row").click()
    await a.page.getByTestId("report-drawer").getByTestId("reopen").click()
    await expect(a.page.getByTestId("report-drawer").getByTestId("mark-reviewed")).toBeVisible({ timeout: 15_000 })

    await s.ctx.close(); await a.ctx.close()
  })

  test("three different reporters make the case urgent and the admin sees the escalation banner", async ({ browser }) => {
    const tag = uid()
    const teacher = await makeAccount("TEACHER", { name: `Şikayetli Hoca ${tag}` })
    for (let i = 0; i < 3; i++) {
      const u = await makeAccount("STUDENT")
      await db.report.create({ data: { reporterId: u.user.id, reportedId: teacher.user.id, reason: `Ders kalitesi çok düşüktü (${i}) ${"x".repeat(10)}`, category: "QUALITY", targetType: "TEACHER", targetId: teacher.teacher!.id, priority: "URGENT" } })
    }
    const admin = await makeAccount("ADMIN")
    const a = await newSession(browser, admin.email)
    await a.page.goto("/admin?tab=reports")
    await a.page.getByTestId("report-search").fill(teacher.user.email!)
    await expect(a.page.getByTestId("report-row")).toHaveCount(3, { timeout: 15_000 })
    await expect(a.page.getByTestId("report-row").first()).toContainText("Acil")
    await expect(a.page.getByTestId("report-row").first()).toContainText("3 açık rapor")

    // three distinct reporters → escalation banner in the drawer
    await a.page.getByTestId("report-row").first().click()
    await expect(a.page.getByTestId("escalation-banner")).toContainText("3 farklı kullanıcı")
    await a.page.keyboard.press("Escape")
    await expect(a.page.getByTestId("report-drawer")).toHaveCount(0)

    // bulk dismissal of two
    const boxes = a.page.getByTestId("report-row").locator("input[type=checkbox]")
    await boxes.nth(0).check()
    await boxes.nth(1).check()
    await expect(a.page.getByTestId("bulk-bar")).toContainText("2 seçili")
    await a.page.getByTestId("bulk-dismiss").click()
    await confirmDialog(a.page)
    await expect(a.page.getByTestId("report-row")).toHaveCount(1, { timeout: 15_000 })

    await a.page.getByTestId("report-row").click()
    // ban from the drawer: reason is mandatory
    const drawer = a.page.getByTestId("report-drawer")
    await drawer.getByTestId("act-ban").click()
    await expect(a.page.getByTestId("confirm-ok")).toBeDisabled()
    await a.page.getByTestId("confirm-input").fill("Tekrarlayan şikayetler")
    await a.page.getByTestId("confirm-ok").click()
    await expect(drawer.getByTestId("report-closed-info")).toContainText("Kullanıcı yasaklandı", { timeout: 15_000 })
    expect((await db.user.findUniqueOrThrow({ where: { id: teacher.user.id } })).banned).toBe(true)
    await a.ctx.close()
  })

  test("a viewer reports a live stream and a chat message; the admin closes the broadcast", async ({ browser }) => {
    await db.liveRoom.updateMany({ where: { isActive: true }, data: { isActive: false, endedAt: new Date() } })
    const tag = uid()
    const teacher = await makeAccount("TEACHER", { name: `Yayıncı ${tag}` })
    const viewer = await makeAccount("STUDENT", { name: `İzleyici ${tag}` })
    const troll = await makeAccount("STUDENT", { name: `Troll ${tag}` })
    const admin = await makeAccount("ADMIN")

    const t = await newSession(browser, teacher.email)
    await t.page.goto("/live/studio")
    await expect(t.page.getByTestId("go-live")).toBeEnabled({ timeout: 30_000 })
    await t.page.getByTestId("stream-title-input").fill(`Rapor Yayını ${tag}`)
    await t.page.getByTestId("go-live").click()
    await expect(t.page.getByTestId("studio-live-badge")).toBeVisible({ timeout: 30_000 })
    const room = await db.liveRoom.findFirstOrThrow({ where: { teacher: { userId: teacher.user.id }, isActive: true } })

    const v = await newSession(browser, viewer.email)
    const tr = await newSession(browser, troll.email)
    for (const p of [v.page, tr.page]) await p.goto(`/live/${room.id}`)
    await expect(v.page.getByTestId("viewer-count")).toContainText("2 izleyici", { timeout: 20_000 })

    await tr.page.getByTestId("chat-input").fill("Bu yayındaki iddialar yanıltıcı, kimse inanmasın")
    await tr.page.getByTestId("chat-send").click()
    const msg = v.page.getByTestId("chat-message").filter({ hasText: "iddialar yanıltıcı" })
    await expect(msg).toBeVisible({ timeout: 15_000 })
    // you cannot report your own message, the host's message, …
    await expect(tr.page.getByTestId("chat-message").filter({ hasText: "iddialar yanıltıcı" }).getByTestId("chat-report")).toHaveCount(0)
    await msg.hover()
    await msg.getByTestId("chat-report").click()
    const dlg = v.page.getByTestId("report-dialog")
    await expect(dlg).toContainText("Bu yayındaki iddialar yanıltıcı, kimse inanmasın")
    await dlg.getByTestId("report-cat-SPAM").check()
    await dlg.getByTestId("report-description").fill("Sohbette sürekli reklam mesajı atıyor, lütfen engelleyin.")
    await dlg.getByTestId("report-submit").click()
    await expect(dlg.getByTestId("report-done")).toBeVisible({ timeout: 15_000 })
    await dlg.getByRole("button", { name: "Tamam" }).click()

    await fileReport(v.page, { open: "report-open-live_room", category: "INAPPROPRIATE_CONTENT", text: "Yayın içeriği platformun yoga amacıyla ilgisiz görünüyor." })

    const chatRow = await db.report.findFirstOrThrow({ where: { reporterId: viewer.user.id, targetType: "CHAT_MESSAGE" } })
    expect(chatRow.reportedId).toBe(troll.user.id) // the server resolved the sender from the message identity
    const streamRow = await db.report.findFirstOrThrow({ where: { reporterId: viewer.user.id, targetType: "LIVE_ROOM" } })
    expect(streamRow.reportedId).toBe(teacher.user.id)

    // admin: chat report → warn the troll; stream report → close the broadcast
    const a = await newSession(browser, admin.email)
    await a.page.goto("/admin?tab=reports")
    await a.page.getByTestId("report-search").fill(troll.user.email!)
    await expect(a.page.getByTestId("report-row")).toHaveCount(1, { timeout: 15_000 })
    await a.page.getByTestId("report-row").click()
    const drawer = a.page.getByTestId("report-drawer")
    await expect(drawer).toContainText("Bu yayındaki iddialar yanıltıcı, kimse inanmasın")
    await expect(drawer).toContainText("bildiren kişinin sunduğu içerik")
    await drawer.getByTestId("act-warn").click()
    await expect(a.page.getByTestId("confirm-ok")).toBeDisabled()
    await confirmDialog(a.page, "Sohbette reklam yapmak yasaktır, lütfen kurallara uyun.")
    await expect(drawer.getByTestId("report-closed-info")).toContainText("Uyarı gönderildi", { timeout: 15_000 })
    await a.page.keyboard.press("Escape")

    // the warned user sees the banner once and can acknowledge it
    await tr.page.goto("/dashboard")
    await expect(tr.page.getByTestId("warning-banner")).toContainText("Sohbette reklam yapmak yasaktır")
    await tr.page.getByTestId("warning-ack").click()
    await expect(tr.page.getByTestId("warning-banner")).toHaveCount(0)
    await tr.page.reload()
    await expect(tr.page.getByTestId("warning-banner")).toHaveCount(0)

    await a.page.getByTestId("report-search").fill(teacher.user.email!)
    await expect(a.page.getByTestId("report-row")).toHaveCount(1, { timeout: 15_000 })
    await a.page.getByTestId("report-row").click()
    await a.page.getByTestId("report-drawer").getByTestId("act-close-room").click()
    await confirmDialog(a.page, "Uygunsuz içerik")
    await expect(a.page.getByTestId("report-drawer").getByTestId("report-closed-info")).toContainText("Canlı yayın kapatıldı", { timeout: 15_000 })
    await expect(v.page.getByText("Yayın sona erdi")).toBeVisible({ timeout: 30_000 })
    expect((await db.liveRoom.findUniqueOrThrow({ where: { id: room.id } })).isActive).toBe(false)

    await t.ctx.close(); await v.ctx.close(); await tr.ctx.close(); await a.ctx.close()
  })
})

test.describe("users, security and audit", () => {
  test("search, warn, ban with a reason, unban from the user drawer; the audit trail records it", async ({ browser }) => {
    const tag = uid()
    const victim = await makeAccount("STUDENT", { name: `Hedef Kişi ${tag}` })
    const admin = await makeAccount("ADMIN")
    const a = await newSession(browser, admin.email)
    await a.page.goto("/admin?tab=users")
    await a.page.getByTestId("admin-user-search").fill(`hedef kişi ${tag}`)
    await expect(a.page.getByTestId("user-row")).toHaveCount(1, { timeout: 15_000 })
    await a.page.getByTestId("user-row").click()
    const drawer = a.page.getByTestId("user-drawer")
    await expect(drawer).toContainText(victim.email)

    await drawer.getByTestId("user-ban").click()
    await expect(a.page.getByTestId("confirm-ok")).toBeDisabled() // reason required
    await confirmDialog(a.page, "Platform kurallarını ihlal etti")
    await expect(drawer.getByTestId("banned-banner")).toContainText("Platform kurallarını ihlal etti", { timeout: 15_000 })
    expect((await db.user.findUniqueOrThrow({ where: { id: victim.user.id } })).banned).toBe(true)

    await drawer.getByTestId("user-unban").click()
    await confirmDialog(a.page)
    await expect(drawer.getByTestId("banned-banner")).toHaveCount(0, { timeout: 15_000 })
    expect((await db.user.findUniqueOrThrow({ where: { id: victim.user.id } })).banned).toBe(false)

    // the list reflects the status filter
    await a.page.keyboard.press("Escape")
    await a.page.getByTestId("user-status-banned").click()
    await expect(a.page.getByTestId("user-row")).toHaveCount(0, { timeout: 15_000 })
    await expect(a.page.getByTestId("empty-state")).toBeVisible()

    // audit trail
    await a.page.getByTestId("nav-audit").click()
    await a.page.getByTestId("audit-search").fill("Platform kurallarını")
    await expect(a.page.getByTestId("audit-row").first()).toContainText("BAN_USER", { timeout: 15_000 })
    const csv = await a.page.request.get(`/api/admin/audit?format=csv&q=${encodeURIComponent("Platform kurallarını")}`)
    expect(await csv.text()).toContain("BAN_USER")
    await a.ctx.close()
  })

  test("security tab validates IP bans and lifts them", async ({ browser }) => {
    const admin = await makeAccount("ADMIN")
    const a = await newSession(browser, admin.email)
    await a.page.goto("/admin?tab=security")
    await a.page.getByTestId("ban-ip").fill("10.1.2.3")
    await a.page.getByTestId("ban-reason").fill("özel ağ denemesi")
    await a.page.getByTestId("ban-submit").click()
    await expect(a.page.getByTestId("ban-form-error")).toContainText("özel")

    const tagged = `Saldırı kaynağı ${uid()}`
    const ip = `198.51.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`
    await a.page.getByTestId("ban-ip").fill(ip)
    await a.page.getByTestId("ban-reason").fill(tagged)
    await a.page.getByTestId("ban-submit").click()
    const row = a.page.getByTestId("ipban-row").filter({ hasText: tagged })
    await expect(row).toBeVisible({ timeout: 15_000 })
    await expect(row).toContainText(ip)
    await expect(row).toContainText("Etkin")
    await row.getByTestId("lift-ban").click()
    await confirmDialog(a.page)
    await expect(row).toContainText("Kaldırıldı", { timeout: 15_000 })
    await a.ctx.close()
  })

  test("bookings and workshops moderation from the panel", async ({ browser }) => {
    const tag = uid()
    const teacher = await makeAccount("TEACHER", { name: `Ders Hoca ${tag}` })
    const student = await makeAccount("STUDENT", { name: `Ders Öğrenci ${tag}` })
    const booking = await db.booking.create({ data: { studentId: student.user.id, teacherId: teacher.teacher!.id, startTime: new Date(Date.now() + 3_600_000), endTime: new Date(Date.now() + 7_200_000), status: "CONFIRMED", price: 40 } })
    await db.workshop.create({ data: { slug: `mod-${tag}`, title: `Moderasyon Atölyesi ${tag}`, description: "x".repeat(40), category: "Yin", mode: "LIVE", status: "PUBLISHED", teacherId: teacher.teacher!.id, startsAt: new Date(Date.now() + 86_400_000), capacity: 5 } })
    const admin = await makeAccount("ADMIN")
    const a = await newSession(browser, admin.email)

    await a.page.goto("/admin?tab=bookings")
    await a.page.getByTestId("booking-search").fill(student.email)
    await expect(a.page.getByTestId("booking-row")).toHaveCount(1, { timeout: 15_000 })
    await a.page.getByTestId("cancel-booking").click()
    await expect(a.page.getByTestId("confirm-ok")).toBeDisabled()
    await confirmDialog(a.page, "Eğitmen rahatsızlandı")
    await expect(a.page.getByTestId("booking-row")).toContainText("İptal", { timeout: 15_000 })
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("CANCELLED")
    await expect(a.page.getByTestId("cancel-booking")).toHaveCount(0)

    await a.page.goto("/admin?tab=workshops")
    await a.page.getByTestId("workshop-search").fill(`Moderasyon Atölyesi ${tag}`)
    await expect(a.page.getByTestId("workshop-row")).toHaveCount(1, { timeout: 15_000 })
    await a.page.getByTestId("unpublish-workshop").click()
    await confirmDialog(a.page, "Kurallara aykırı")
    await expect(a.page.getByTestId("workshop-row")).toContainText("Taslak", { timeout: 15_000 })
    await a.ctx.close()
  })
})
