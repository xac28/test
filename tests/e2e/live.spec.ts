import { test, expect, makeAccount, newSession, db } from "./helpers"

test.describe("live broadcast (real LiveKit, fake camera)", () => {
  test("teacher goes live, student watches, changes quality, chats; teacher moderates and ends", async ({ browser }) => {
    // leftovers from earlier runs must not appear in the directory
    await db.liveRoom.updateMany({ where: { isActive: true }, data: { isActive: false, endedAt: new Date() } })
    const teacher = await makeAccount("TEACHER", { name: "Eğitmen Deniz" })
    const student = await makeAccount("STUDENT", { name: "Öğrenci Ayşe" })
    const { ctx: tctx, page: tp } = await newSession(browser, teacher.email)

    // ── studio ───────────────────────────────────────────────
    await tp.goto("/live/studio")
    await expect(tp.getByTestId("go-live")).toBeEnabled({ timeout: 30_000 })
    // quality presets
    for (const id of ["1080p60", "1080p30", "720p60", "720p30", "480p30", "360p30"]) {
      await expect(tp.getByTestId(`preset-${id}`)).toBeVisible()
    }
    await tp.getByTestId("preset-1080p30").click()
    await tp.getByTestId("stream-title-input").fill("Sabah Akışı E2E")
    await tp.getByTestId("go-live").click()
    await expect(tp.getByTestId("studio-live-badge")).toBeVisible({ timeout: 30_000 })

    const room = await db.liveRoom.findFirst({ where: { teacher: { userId: teacher.user.id }, isActive: true } })
    expect(room?.title).toBe("Sabah Akışı E2E")

    // ── viewer ───────────────────────────────────────────────
    const { ctx: sctx, page: sp } = await newSession(browser, student.email)
    await sp.goto("/live")
    const card = sp.locator(`a[data-testid="broadcast-card"][href="/live/${room!.id}"]`)
    await expect(card).toBeVisible({ timeout: 20_000 })
    await card.click()
    await expect(sp).toHaveURL(new RegExp(`/live/${room!.id}$`))
    await expect(sp.getByTestId("stream-title")).toHaveText("Sabah Akışı E2E")

    // the video really plays (frames flowing)
    const video = sp.getByTestId("live-video")
    await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 30_000 }).toBeGreaterThan(0)
    await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => v.readyState >= 2 && !v.paused), { timeout: 15_000 }).toBe(true)

    // counts
    await expect(sp.getByTestId("viewer-count")).toContainText("1 izleyici", { timeout: 15_000 })
    await expect(tp.getByTestId("studio-viewers")).toContainText("1", { timeout: 15_000 })

    // quality menu: Auto / 1080p / 720p / 360p / audio only
    await sp.getByTestId("live-player").hover()
    await sp.getByTestId("quality-button").click()
    const menu = sp.getByTestId("quality-menu")
    await expect(menu).toBeVisible()
    for (const id of ["auto", "1080", "720", "360", "audio"]) await expect(sp.getByTestId(`quality-${id}`)).toBeVisible()
    await sp.getByTestId("quality-360").click()
    await expect(sp.getByTestId("quality-button")).toContainText("360p")
    // the resolution actually drops to the 360p layer
    await sp.getByTestId("toggle-stats").click()
    await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => v.videoHeight), { timeout: 30_000 }).toBeLessThanOrEqual(360)
    await expect(sp.getByTestId("stats-panel")).toContainText("360")
    // back to the best layer
    await sp.getByTestId("quality-button").click()
    await sp.getByTestId("quality-1080").click()
    await expect.poll(async () => video.evaluate((v: HTMLVideoElement) => v.videoHeight), { timeout: 40_000 }).toBeGreaterThanOrEqual(720)
    // audio only hides the video
    await sp.getByTestId("quality-button").click()
    await sp.getByTestId("quality-audio").click()
    await expect(sp.getByText("Yalnız ses modu")).toBeVisible()
    await sp.getByTestId("quality-button").click()
    await sp.getByTestId("quality-auto").click()

    // controls
    await sp.getByTestId("theater").click()
    await sp.getByTestId("mute").click()
    await sp.getByTestId("mute").click()

    // chat both ways
    await sp.getByTestId("chat-input").fill("Merhaba hocam 🙏")
    await sp.getByTestId("chat-send").click()
    await expect(tp.getByTestId("chat-message").filter({ hasText: "Merhaba hocam" })).toBeVisible({ timeout: 15_000 })
    await tp.getByTestId("chat-input").fill("Hoş geldin!")
    await tp.getByTestId("chat-send").click()
    const hostMsg = sp.getByTestId("chat-message").filter({ hasText: "Hoş geldin!" })
    await expect(hostMsg).toBeVisible({ timeout: 15_000 })
    await expect(hostMsg).toContainText("Eğitmen") // host badge

    // slow mode set by the teacher reaches the viewer
    await tp.getByRole("button", { name: /Denetim/ }).click()
    await tp.getByTestId("slow-mode").selectOption("30")
    await expect(sp.getByText("Yavaş mod · 30 sn")).toBeVisible({ timeout: 15_000 })
    await sp.getByTestId("chat-input").fill("ikinci mesaj")
    await sp.getByTestId("chat-send").click()
    await expect(sp.getByTestId("live-chat").getByRole("alert")).toContainText("Yavaş mod")
    // chat off
    await tp.getByTestId("chat-enabled").click()
    await expect(sp.getByTestId("chat-input")).toBeDisabled({ timeout: 15_000 })
    await tp.getByTestId("chat-enabled").click()
    await expect(sp.getByTestId("chat-input")).toBeEnabled({ timeout: 15_000 })

    // studio health panel
    await expect(tp.getByTestId("health")).toContainText("Çözünürlük", { timeout: 15_000 })

    // teacher ends → viewer sees the ended screen
    tp.once("dialog", (d) => d.accept())
    await tp.getByTestId("end-stream").click()
    await expect(sp.getByText("Yayın sona erdi")).toBeVisible({ timeout: 30_000 })
    await expect(tp.getByText("Yayın bitti")).toBeVisible()
    const after = await db.liveRoom.findUnique({ where: { id: room!.id } })
    expect(after?.isActive).toBe(false)

    // an ended stream cannot be joined again
    const res = await sp.request.post(`/api/live/${room!.id}/join`)
    expect(res.status()).toBe(404)

    await tctx.close()
    await sctx.close()
  })
})
