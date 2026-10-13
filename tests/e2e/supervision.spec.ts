import { test, expect, makeAccount, newSession, db } from "./helpers"

test.describe("supervised broadcasts of trial-phase teachers (real LiveKit, fake camera)", () => {
  test("trial teacher goes live; an official watches unseen, writes to the teacher and the room, restricts the chat and approves", async ({ browser }) => {
    test.setTimeout(180_000)
    await db.liveRoom.updateMany({ where: { isActive: true }, data: { isActive: false, endedAt: new Date() } })
    const teacher = await makeAccount("TEACHER", { name: "Deneme Eğitmeni Elif" })
    await db.teacher.update({ where: { id: teacher.teacher!.id }, data: { isTrialMode: true } })
    const admin = await makeAccount("ADMIN", { name: "Yetkili Ali" })
    const student = await makeAccount("STUDENT", { name: "İzleyici Zeynep" })

    // ── the teacher is told what to expect, then goes live ─────────────────
    const { ctx: tctx, page: tp } = await newSession(browser, teacher.email)
    await tp.goto("/teach")
    await expect(tp.getByTestId("badge-trial").first()).toBeVisible()
    await tp.goto("/live/studio")
    await expect(tp.getByTestId("studio-trial-note")).toContainText("canlı izlenir")
    await expect(tp.getByTestId("go-live")).toBeEnabled({ timeout: 30_000 })
    await tp.getByTestId("stream-title-input").fill("Deneme Akışı E2E")
    await tp.getByTestId("go-live").click()
    await expect(tp.getByTestId("studio-live-badge")).toBeVisible({ timeout: 30_000 })
    await expect(tp.getByTestId("studio-supervised")).toBeVisible()
    const room = await db.liveRoom.findFirstOrThrow({ where: { teacher: { userId: teacher.user.id }, isActive: true } })
    expect(room.supervised).toBe(true)

    // ── a viewer sees the trial badge and the supervision note ─────────────
    const { ctx: sctx, page: sp } = await newSession(browser, student.email)
    await sp.goto("/live")
    const card = sp.locator(`a[data-testid="broadcast-card"][href="/live/${room.id}"]`)
    await expect(card).toBeVisible({ timeout: 20_000 })
    await expect(card.getByTestId("badge-trial")).toBeVisible()
    await card.click()
    await expect(sp.getByTestId("supervised-note")).toBeVisible()
    await expect(sp.getByTestId("badge-trial")).toBeVisible()
    await expect(sp.getByTestId("viewer-count")).toContainText("1 izleyici", { timeout: 15_000 })

    // ── the official: alert in the panel, the monitor tab lists it first ───
    const { ctx: actx, page: ap } = await newSession(browser, admin.email)
    await ap.goto("/admin?tab=monitor")
    const mcard = ap.locator(`[data-testid=monitor-card][data-supervised="1"]`).filter({ hasText: "Deneme Akışı E2E" })
    await expect(mcard).toBeVisible({ timeout: 20_000 })
    await expect(mcard.getByTestId("badge-trial")).toBeVisible()
    await expect(ap.getByTestId("nav-monitor")).toContainText(/\d/) // the sidebar counts supervised broadcasts

    // ── watch: video flows, and the official is invisible (viewer counts stay 1) ──
    await mcard.getByTestId("monitor-watch").click()
    await expect(ap).toHaveURL(new RegExp(`/admin/izle/${room.id}$`))
    await expect(ap.getByTestId("monitor-title")).toHaveText("Deneme Akışı E2E", { timeout: 30_000 })
    const video = ap.getByTestId("monitor-player").locator("video").first()
    await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 30_000 }).toBeGreaterThan(0)
    await expect(sp.getByTestId("viewer-count")).toContainText("1 izleyici")
    await expect(tp.getByTestId("studio-viewers")).toContainText("1")
    await expect(ap.getByTestId("monitor-viewers")).toContainText("1")
    expect(await db.auditLog.count({ where: { actorId: admin.user.id, action: "WATCH_LIVE", targetId: room.id } })).toBe(1)

    // ── a private message reaches only the teacher ────────────────────────
    await ap.getByTestId("notice-text").fill("Lütfen kamerayı biraz yukarı al.")
    await ap.getByTestId("notice-send").click()
    await expect(tp.getByTestId("staff-notice-text")).toHaveText("Lütfen kamerayı biraz yukarı al.", { timeout: 15_000 })
    await expect(sp.getByTestId("staff-notice")).toHaveCount(0)
    await tp.getByTestId("staff-notice-close").click()
    await expect(tp.getByTestId("staff-notice")).toHaveCount(0)

    // ── an announcement reaches the whole room ────────────────────────────
    await ap.getByTestId("aud-all").check()
    await ap.getByTestId("notice-text").fill("Bu bir deneme yayınıdır, hoş geldiniz.")
    await ap.getByTestId("notice-send").click()
    await expect(sp.getByTestId("staff-notice-text")).toHaveText("Bu bir deneme yayınıdır, hoş geldiniz.", { timeout: 15_000 })
    await expect(tp.getByTestId("staff-notice-text")).toBeVisible({ timeout: 15_000 })

    // ── slow mode from the monitor reaches the viewer's chat ──────────────
    await ap.getByTestId("slow-30").click()
    await expect(sp.getByText("30 sn")).toBeVisible({ timeout: 15_000 })

    // ── the decision: approve → the badge flips everywhere ────────────────
    await ap.getByTestId("trial-approve").click()
    await ap.getByTestId("confirm-ok").click()
    await expect(ap.getByTestId("badge-approved").first()).toBeVisible({ timeout: 15_000 })
    expect((await db.teacher.findUniqueOrThrow({ where: { id: teacher.teacher!.id } })).isTrialMode).toBe(false)
    await sp.goto("/live")
    await expect(sp.locator(`a[data-testid="broadcast-card"][href="/live/${room.id}"]`).getByTestId("badge-approved")).toBeVisible({ timeout: 15_000 })

    // ── closing from the monitor ends the stream for everybody ─────────────
    await ap.getByTestId("monitor-end").click()
    const dlg = ap.getByTestId("confirm-dialog")
    await dlg.getByTestId("confirm-input").fill("Deneme tamamlandı")
    await dlg.getByTestId("confirm-ok").click()
    await expect(ap.getByTestId("monitor-ended")).toBeVisible({ timeout: 20_000 })
    expect((await db.liveRoom.findUniqueOrThrow({ where: { id: room.id } })).isActive).toBe(false)
    expect(await db.auditLog.count({ where: { targetId: room.id, action: { in: ["LIVE_NOTICE", "CLOSE_ROOM", "WATCH_LIVE"] } } })).toBe(4)

    await Promise.all([tctx.close(), sctx.close(), actx.close()])
  })

  test("approved teachers wear the approved badge on cards, profiles and the panel", async ({ browser, page }) => {
    const t = await makeAccount("TEACHER", { name: "Onaylı Eğitmen Deniz" })
    const s = await newSession(browser, t.email)
    await s.page.goto("/teach")
    await expect(s.page.getByTestId("badge-approved").first()).toBeVisible()
    await s.ctx.close()
    await page.goto(`/teachers/${t.teacher!.id}`)
    await expect(page.getByTestId("badge-approved").first()).toBeVisible({ timeout: 15_000 })
    await page.goto("/teachers")
    await expect(page.getByTestId("badge-approved").first()).toBeVisible({ timeout: 15_000 })
  })
})
