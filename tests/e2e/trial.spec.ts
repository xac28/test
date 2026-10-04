import { test, expect, makeAccount, newSession, db } from "./helpers"

async function trialTeacher(name: string) {
  const acc = await makeAccount("TEACHER", { name })
  await db.teacher.update({ where: { id: acc.teacher!.id }, data: { isTrialMode: true } })
  return acc
}

test.describe("teacher vetting: trial room", () => {
  test("a trial teacher is held back, goes before an admin live, and is approved", async ({ browser }) => {
    await db.liveRoom.updateMany({ where: { isActive: true }, data: { isActive: false, endedAt: new Date() } })
    const uid = Math.random().toString(36).slice(2, 7)
    const name = `Aday Eğitmen ${uid}`
    const cand = await trialTeacher(name)
    const admin = await makeAccount("ADMIN", { name: "Yetkili Değerlendirici" })
    const stranger = await makeAccount("STUDENT")

    // ── before approval ──
    const t = await newSession(browser, cand.email)
    await t.page.goto("/teach")
    await expect(t.page.getByText("Deneme Aşamasındasınız")).toBeVisible()
    await expect(t.page.getByTestId("go-live-link")).toHaveCount(0) // no public "go live" for unapproved teachers
    // even by hand the studio refuses
    await t.page.goto("/live/studio")
    await expect(t.page.getByTestId("go-live")).toBeEnabled({ timeout: 30_000 })
    await t.page.getByTestId("go-live").click()
    await expect(t.page.getByRole("alert").filter({ hasText: "deneme yayınını tamamlamalısınız" })).toBeVisible({ timeout: 15_000 })

    // the legacy link shape redirects to the real room
    await t.page.goto(`/room/trial-${cand.teacher!.id}`)
    await expect(t.page).toHaveURL(new RegExp(`/room/trial/${cand.teacher!.id}$`))
    await expect(t.page.getByTestId("trial-title")).toContainText(name)
    await expect(t.page.getByTestId("trial-status")).toContainText("Yetkili bekleniyor", { timeout: 30_000 })

    // strangers are turned away
    const s = await newSession(browser, stranger.email)
    await s.page.goto(`/room/trial/${cand.teacher!.id}`)
    await expect(s.page).toHaveURL(/\/dashboard/)

    // ── admin sees the candidate waiting and joins ──
    const a = await newSession(browser, admin.email)
    await a.page.goto("/admin?tab=trials")
    const row = a.page.getByTestId("trial-row").filter({ hasText: name })
    await expect(row).toBeVisible({ timeout: 20_000 })
    await expect(row.getByTestId("trial-in-room")).toBeVisible({ timeout: 25_000 })

    const [roomPage] = await Promise.all([a.ctx.waitForEvent("page"), row.getByTestId("trial-join").click()])
    await expect(roomPage.getByTestId("trial-status")).toContainText("Aday odada", { timeout: 30_000 })
    await expect(t.page.getByTestId("trial-status")).toContainText("Yetkili odada", { timeout: 30_000 })
    await expect(t.page.getByTestId("trial-timer")).toBeVisible()

    // ── decision from inside the room ──
    roomPage.once("dialog", (d) => d.accept())
    await roomPage.getByTestId("room-approve").click()
    await expect(t.page.getByTestId("trial-decision")).toContainText("Onaylandı", { timeout: 20_000 })
    await expect(roomPage.getByTestId("trial-decision")).toContainText("Onaylandı")
    expect((await db.teacher.findUnique({ where: { id: cand.teacher!.id } }))?.isTrialMode).toBe(false)

    // ── after approval ──
    await t.page.goto("/teach")
    await expect(t.page.getByText("Deneme Aşamasındasınız")).toHaveCount(0)
    await expect(t.page.getByTestId("go-live-link")).toBeVisible()
    await t.page.goto(`/room/trial/${cand.teacher!.id}`)
    await expect(t.page).toHaveURL(/\/teach$/) // no trial room for approved teachers
    await t.page.goto("/live/studio")
    await expect(t.page.getByTestId("go-live")).toBeEnabled({ timeout: 30_000 })
    await t.page.getByTestId("go-live").click()
    await expect(t.page.getByTestId("studio-live-badge")).toBeVisible({ timeout: 30_000 })
    t.page.once("dialog", (d) => d.accept())
    await t.page.getByTestId("end-stream").click()
    await expect(t.page.getByText("Yayın bitti")).toBeVisible({ timeout: 20_000 })

    // ── the admin can take the approval back ──
    await a.page.goto("/admin?tab=trials")
    const approved = a.page.getByTestId("approved-row").filter({ hasText: name })
    await expect(approved).toBeVisible()
    a.page.once("dialog", (d) => d.accept("Uygunsuz davranış bildirimi"))
    await approved.getByTestId("trial-revoke").click()
    await expect(a.page.getByTestId("trial-row").filter({ hasText: name })).toBeVisible({ timeout: 20_000 })
    await t.page.goto("/teach")
    await expect(t.page.getByText("Deneme Aşamasındasınız")).toBeVisible()
    await expect(t.page.getByTestId("trial-note")).toContainText("Uygunsuz davranış bildirimi")

    await t.ctx.close(); await a.ctx.close(); await s.ctx.close()
  })

  test("rejecting a trial keeps the teacher out and shows the reason", async ({ browser }) => {
    const uid = Math.random().toString(36).slice(2, 7)
    const name = `Reddedilen Aday ${uid}`
    const cand = await trialTeacher(name)
    const admin = await makeAccount("ADMIN")
    const a = await newSession(browser, admin.email)
    await a.page.goto("/admin?tab=trials")
    const row = a.page.getByTestId("trial-row").filter({ hasText: name })
    await expect(row).toBeVisible({ timeout: 20_000 })
    a.page.once("dialog", (d) => d.accept("Görüntü ve ses kalitesi yetersiz"))
    await row.getByTestId("trial-reject").click()
    await expect(row.getByText("Son not: Görüntü ve ses kalitesi yetersiz")).toBeVisible({ timeout: 20_000 })
    expect((await db.teacher.findUnique({ where: { id: cand.teacher!.id } }))?.isTrialMode).toBe(true)

    const t = await newSession(browser, cand.email)
    await t.page.goto("/teach")
    await expect(t.page.getByTestId("trial-note")).toContainText("Görüntü ve ses kalitesi yetersiz")
    await t.ctx.close(); await a.ctx.close()
  })
})
