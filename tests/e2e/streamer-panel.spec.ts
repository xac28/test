import fs from "fs"
import path from "path"
import { test, expect, makeAccount, newSession, db } from "./helpers"

const haveRelease = fs.existsSync(path.join(process.cwd(), "storage", "downloads", "streamer.json"))

test.describe("the desktop-app page (/teach/uygulama)", () => {
  test("students and visitors never see it; a teacher downloads, makes a pairing code and removes a computer", async ({ browser, page }) => {
    // visitor → login, student → bounced away from the page
    await page.goto("/teach/uygulama")
    await expect(page).not.toHaveURL(/uygulama/)

    const student = await makeAccount("STUDENT")
    const s = await newSession(browser, student.email)
    await s.page.goto("/teach/uygulama")
    await expect(s.page.getByTestId("streamer-panel")).toHaveCount(0)
    await expect(s.page.getByTestId("streamer-download-link")).toHaveCount(0)
    await s.ctx.close()

    // trial teacher: same access as approved ones
    const teacher = await makeAccount("TEACHER", { name: "Uygulama Eğitmeni" })
    await db.teacher.update({ where: { id: teacher.teacher!.id }, data: { isTrialMode: true } })
    const t = await newSession(browser, teacher.email)
    await t.page.goto("/teach")
    await t.page.getByRole("link", { name: "Yayın Uygulaması" }).first().click()
    await expect(t.page).toHaveURL(/\/teach\/uygulama/)
    await expect(t.page.getByTestId("streamer-panel")).toBeVisible()
    if (haveRelease) {
      await expect(t.page.getByTestId("streamer-download-link")).toHaveAttribute("href", "/api/streamer/download")
      await expect(t.page.getByTestId("streamer-sha")).toHaveText(/^[0-9a-f]{64}$/)
      const dl = t.page.waitForEvent("download")
      await t.page.getByTestId("streamer-download-link").click()
      expect((await dl).suggestedFilename()).toMatch(/\.exe$/)
    } else {
      await expect(t.page.getByTestId("streamer-unavailable")).toBeVisible()
    }

    // pairing code: shown once, stored only as a hash
    await t.page.getByTestId("pair-new").click()
    await expect(t.page.getByTestId("pair-code")).toHaveText(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    const shown = (await t.page.getByTestId("pair-code").textContent())!
    const rows = await db.streamerPairing.findMany({ where: { userId: teacher.user.id } })
    expect(rows).toHaveLength(1)
    expect(JSON.stringify(rows[0])).not.toContain(shown)

    // a connected computer is listed and can be removed
    await db.streamerDevice.create({ data: { userId: teacher.user.id, name: "Stüdyo bilgisayarı", tokenHash: `h-${Date.now()}`, expiresAt: new Date(Date.now() + 86_400_000) } })
    await t.page.reload()
    const row = t.page.getByTestId("device-row").filter({ hasText: "Stüdyo bilgisayarı" })
    await expect(row).toBeVisible()
    await row.getByTestId("device-remove").click()
    await expect(row).toHaveCount(0)
    const gone = await db.streamerDevice.findFirst({ where: { userId: teacher.user.id } })
    expect(gone?.revokedAt).not.toBeNull()

    // a suspended teacher loses the download and the code, the page says why
    await db.user.update({ where: { id: teacher.user.id }, data: { suspendedUntil: new Date(Date.now() + 86_400_000) } })
    await t.page.goto("/teach/uygulama")
    await expect(t.page.getByTestId("streamer-denied")).toBeVisible()
    await expect(t.page.getByTestId("pair-new")).toHaveCount(0)
    await expect(t.page.getByTestId("streamer-download-link")).toHaveCount(0)
    await t.ctx.close()
  })
})
