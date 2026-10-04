import { test, expect, makeAccount, newSession, db } from "./helpers"

test.describe("lesson recording (real browser recording → server → download)", () => {
  test("teacher records a booked lesson; student sees the notice; only they can download a playable file", async ({ browser }) => {
    const teacher = await makeAccount("TEACHER", { name: "Eğitmen Kayıt" })
    const student = await makeAccount("STUDENT", { name: "Öğrenci Kayıt" })
    const outsider = await makeAccount("STUDENT", { name: "Yabancı Kişi" })
    const start = new Date()
    const booking = await db.booking.create({
      data: {
        teacherId: teacher.teacher!.id,
        studentId: student.user.id,
        startTime: start,
        endTime: new Date(start.getTime() + 3_600_000),
        status: "CONFIRMED",
        price: 40,
      },
    })

    const { ctx: tctx, page: tp } = await newSession(browser, teacher.email)
    const { ctx: sctx, page: sp } = await newSession(browser, student.email)
    await tp.goto(`/room?bookingId=${booking.id}`)
    await sp.goto(`/room?bookingId=${booking.id}`)

    const recordBtn = tp.getByTestId("record-lesson")
    await expect(recordBtn).toBeEnabled({ timeout: 40_000 })
    // the old local-download button is gone
    await expect(tp.getByText("Dersi Kaydet (Lokal)")).toHaveCount(0)

    // both sides connected: wait until the student's video of the teacher flows
    await expect(sp.locator("video").first()).toBeVisible({ timeout: 40_000 })
    await tp.waitForTimeout(3000)

    await recordBtn.click()
    await expect(tp.getByTestId("rec-indicator")).toContainText("KAYITTA", { timeout: 20_000 })
    await expect(sp.getByTestId("rec-indicator")).toContainText("Bu ders kaydediliyor", { timeout: 20_000 })

    await tp.waitForTimeout(13_000) // ≥ 2 chunks of 5 s
    await recordBtn.click()
    await expect(tp.getByText(/Kayıt hazır/)).toBeVisible({ timeout: 40_000 })
    await expect(sp.getByTestId("rec-indicator")).toHaveCount(0, { timeout: 20_000 })

    const rec = await db.lessonRecording.findFirst({ where: { bookingId: booking.id } })
    expect(rec?.status).toBe("READY")
    expect(rec!.chunkCount).toBeGreaterThanOrEqual(2)
    expect(Number(rec!.sizeBytes)).toBeGreaterThan(20_000)
    expect(rec!.teacherUserId).toBe(teacher.user.id)
    expect(rec!.studentUserId).toBe(student.user.id)
    expect(rec!.durationSec).toBeGreaterThanOrEqual(10)

    // ── download links on both dashboards ──
    await tp.goto("/teach")
    const tItem = tp.getByTestId("recording-item").first()
    await expect(tItem).toBeVisible({ timeout: 20_000 })
    await expect(tItem).toContainText("30 gün sonra silinecek")
    await sp.goto("/dashboard")
    const sItem = sp.getByTestId("recording-item").first()
    await expect(sItem).toBeVisible({ timeout: 20_000 })
    await expect(sItem.getByRole("link", { name: /İndir/ })).toHaveAttribute("href", `/api/recordings/${rec!.id}/download`)

    // ── download as the student and check it is a real, playable WebM ──
    const res = await sp.request.get(`/api/recordings/${rec!.id}/download`)
    expect(res.status()).toBe(200)
    expect(res.headers()["content-disposition"]).toContain("attachment")
    const bytes = await res.body()
    expect(bytes.subarray(0, 4).toString("hex")).toBe("1a45dfa3") // EBML header
    expect(bytes.length).toBe(Number(rec!.sizeBytes))

    const info = await sp.evaluate(async (b64: string) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      const url = URL.createObjectURL(new Blob([bin], { type: "video/webm" }))
      const v = document.createElement("video")
      v.muted = true
      v.src = url
      await new Promise<void>((resolve, reject) => {
        v.onloadeddata = () => resolve()
        v.onerror = () => reject(new Error("recording is not playable"))
        setTimeout(() => reject(new Error("timeout loading recording")), 15000)
      })
      return { w: v.videoWidth, h: v.videoHeight }
    }, bytes.toString("base64"))
    expect(info).toEqual({ w: 1280, h: 720 })

    // ── an outsider gets nothing ──
    const { ctx: octx, page: op } = await newSession(browser, outsider.email)
    expect((await op.request.get(`/api/recordings/${rec!.id}/download`)).status()).toBe(404)
    await op.goto("/dashboard")
    await expect(op.getByTestId("recordings-section")).toContainText("Henüz indirilebilir ders kaydı yok", { timeout: 20_000 })

    await tctx.close()
    await sctx.close()
    await octx.close()
  })

  test("recording from the live studio", async ({ browser }) => {
    await db.liveRoom.updateMany({ where: { isActive: true }, data: { isActive: false, endedAt: new Date() } })
    const teacher = await makeAccount("TEACHER", { name: "Eğitmen Stüdyo" })
    const { ctx, page } = await newSession(browser, teacher.email)
    await page.goto("/live/studio")
    await expect(page.getByTestId("go-live")).toBeEnabled({ timeout: 30_000 })
    await page.getByTestId("go-live").click()
    await expect(page.getByTestId("studio-live-badge")).toBeVisible({ timeout: 30_000 })

    await page.getByTestId("record-stream").click()
    await expect(page.getByTestId("studio-rec")).toBeVisible({ timeout: 20_000 })
    await page.waitForTimeout(12_000)
    await page.getByTestId("record-stream").click()
    await expect(page.getByText(/Kayıt yüklendi/)).toBeVisible({ timeout: 40_000 })

    const rec = await db.lessonRecording.findFirst({ where: { teacherUserId: teacher.user.id } })
    expect(rec?.status).toBe("READY")
    expect(rec?.liveRoomId).toBeTruthy()
    expect(rec?.studentUserId).toBeNull()
    expect((await page.request.get(`/api/recordings/${rec!.id}/download`)).status()).toBe(200)

    page.once("dialog", (d) => d.accept())
    await page.getByTestId("end-stream").click()
    await expect(page.getByText("Yayın bitti")).toBeVisible({ timeout: 20_000 })
    await ctx.close()
  })
})
