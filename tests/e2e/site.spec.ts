import { test, expect, makeAccount, newSession, login, db, PASSWORD } from "./helpers"
import type { Page } from "@playwright/test"

const IGNORED_ERRORS = [/ERR_TUNNEL_CONNECTION_FAILED/, /Failed to load resource/, /favicon/, /fonts\.g/, /pravatar/, /unsplash/, /Download the React DevTools/, /WebSocket/i, /LiveKit|livekit/i]

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`))
  page.on("console", (m) => {
    if (m.type() === "error" && !IGNORED_ERRORS.some((r) => r.test(m.text()))) errors.push(`console: ${m.text()}`)
  })
  return errors
}

test.describe("public pages", () => {
  test("every public page renders, is branded AYA, Turkish, error-free", async ({ page }) => {
    const errors = collectErrors(page)
    const ws = await db.workshop.findFirst({ where: { status: "PUBLISHED" } })
    const art = await db.article.findFirst({ where: { status: "PUBLISHED" } })
    const paths = ["/", "/atolyeler", ws ? `/atolyeler/${ws.slug}` : null, "/icerikler", art ? `/icerikler/${art.slug}` : null, "/teachers", "/pricing", "/login", "/terms", "/privacy"].filter(Boolean) as string[]

    for (const p of paths) {
      const res = await page.goto(p)
      expect(res?.status(), p).toBe(200)
      await page.waitForLoadState("networkidle").catch(() => {})
      const text = await page.locator("body").innerText()
      expect(text, `${p} must not say Namaste`).not.toMatch(/namaste/i)
      expect(await page.title(), p).toMatch(/AYA/)
      expect(await page.locator("html").getAttribute("lang")).toBe("tr")
      // layout sanity: no horizontal scroll
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, `${p} horizontal overflow`).toBeLessThanOrEqual(1)
    }
    expect(errors).toEqual([])
  })

  test("navigation links work and mobile menu opens", async ({ page, browser }) => {
    await page.goto("/")
    for (const [label, url] of [["Atölyeler", /\/atolyeler$/], ["Eğitmenler", /\/teachers$/], ["İçerikler", /\/icerikler$/], ["Paketler", /\/pricing$/]] as const) {
      await page.getByRole("navigation", { name: "Ana menü" }).getByRole("link", { name: label, exact: true }).click()
      await expect(page).toHaveURL(url)
    }
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const m = await ctx.newPage()
    await m.goto("/")
    await m.getByRole("button", { name: "Menüyü aç" }).click()
    await expect(m.getByRole("link", { name: "Atölyeler" }).first()).toBeVisible()
    const overflow = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    await ctx.close()
  })

  test("workshop and article lists filter correctly; unknown slugs are 404", async ({ page }) => {
    await page.goto("/atolyeler?mode=RECORDED")
    for (const c of await page.getByTestId("workshop-card").all()) await expect(c).toContainText("Kayıtlı")
    await page.goto("/atolyeler?category=YokBoyleBirKategori")
    await expect(page.getByTestId("no-workshops")).toBeVisible()
    expect((await page.goto("/atolyeler/yok-boyle-bir-atolye"))?.status()).toBe(404)
    expect((await page.goto("/icerikler/yok-boyle-bir-yazi"))?.status()).toBe(404)
  })

  test("English switch translates the new pages", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "en", exact: true }).first().click()
    await expect(page.getByRole("heading", { level: 1 })).toContainText("A live school for breath,")
    await page.getByRole("button", { name: "tr", exact: true }).first().click()
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Nefes, beden ve zihin için")
  })
})

test.describe("registration, terms gate, role protection", () => {
  test("register form requires the terms box; new account lands on profile completion", async ({ page }) => {
    await page.goto("/login")
    await page.getByRole("tab", { name: "Kayıt Ol" }).click()
    const submit = page.locator("form button[type=submit]")
    await page.getByPlaceholder("Ad Soyad").fill("Kayıt Deneme")
    const email = `reg-${Date.now()}@aya.test`
    await page.getByPlaceholder("E-posta adresi").fill(email)
    await page.getByPlaceholder("Şifre").fill(PASSWORD)
    await expect(submit).toBeDisabled()
    await page.getByTestId("register-accept-terms").check()
    await expect(submit).toBeEnabled()
    await submit.click()
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 })
    const u = await db.user.findUnique({ where: { email } })
    expect(u?.termsAcceptedAt).toBeTruthy()
    await db.user.delete({ where: { email } })
  })

  test("a signed-in user without accepted terms is gated everywhere until they accept", async ({ browser }) => {
    const acc = await makeAccount("STUDENT", { terms: false })
    const { ctx, page } = await newSession(browser, acc.email)
    for (const p of ["/dashboard", "/atolyeler", "/pricing"]) {
      await page.goto(p)
      await expect(page).toHaveURL(/\/accept-terms\?next=/)
    }
    // terms / privacy stay readable
    await page.goto("/terms")
    await expect(page).toHaveURL(/\/terms$/)

    await page.goto("/atolyeler")
    const submit = page.getByTestId("accept-terms-submit")
    await expect(submit).toBeDisabled()
    await page.getByTestId("accept-terms-checkbox").check()
    await submit.click()
    await expect(page).toHaveURL(/\/atolyeler$/, { timeout: 20_000 })
    expect((await db.user.findUnique({ where: { id: acc.user.id } }))?.termsAcceptedAt).toBeTruthy()
    // the gate is lifted for the session
    await page.goto("/pricing")
    await expect(page).toHaveURL(/\/pricing$/)
    await ctx.close()
  })

  test("accept-terms refuses open redirects", async ({ browser }) => {
    const acc = await makeAccount("STUDENT", { terms: false })
    const { ctx, page } = await newSession(browser, acc.email)
    await page.goto("/accept-terms?next=https://evil.example/phish")
    await page.getByTestId("accept-terms-checkbox").check()
    await page.getByTestId("accept-terms-submit").click()
    await expect(page).toHaveURL(/localhost:3000\/dashboard/, { timeout: 20_000 })
    await ctx.close()
  })

  test("role protection in the middleware", async ({ browser, page }) => {
    // anonymous
    for (const p of ["/dashboard", "/teach", "/admin", "/live", "/live/studio"]) {
      await page.goto(p)
      await expect(page, p).toHaveURL(/localhost:3000\/(login.*)?$/)
    }
    const student = await makeAccount("STUDENT")
    const teacher = await makeAccount("TEACHER")
    const admin = await makeAccount("ADMIN")

    const s = await newSession(browser, student.email)
    await s.page.goto("/teach"); await expect(s.page).toHaveURL(/\/dashboard/)
    await s.page.goto("/admin"); await expect(s.page).toHaveURL(/\/dashboard/)
    // "/teachers" (public) must NOT be treated as the teacher area
    await s.page.goto("/teachers"); await expect(s.page).toHaveURL(/\/teachers$/)
    await s.page.goto("/live/studio"); await expect(s.page).toHaveURL(/\/live$/)

    const t = await newSession(browser, teacher.email)
    await t.page.goto("/teach"); await expect(t.page).toHaveURL(/\/teach$/)
    await t.page.goto("/admin"); await expect(t.page).toHaveURL(/\/dashboard/)

    const a = await newSession(browser, admin.email)
    await a.page.goto("/admin"); await expect(a.page).toHaveURL(/\/admin/)
    await expect(a.page.getByText("Yönetim Paneli").first()).toBeVisible()
    await s.ctx.close(); await t.ctx.close(); await a.ctx.close()
  })
})

test.describe("payout requests (teacher → admin)", () => {
  test("teacher requests, admin approves & pays; another request is rejected with a reason", async ({ browser }) => {
    const uid = Math.random().toString(36).slice(2, 7)
    const tname = `Eğitmen Kazanç ${uid}`
    const teacher = await makeAccount("TEACHER", { name: tname })
    const student = await makeAccount("STUDENT")
    const admin = await makeAccount("ADMIN", { name: "Yönetici Onay" })
    for (let i = 0; i < 2; i++) {
      await db.booking.create({
        data: { teacherId: teacher.teacher!.id, studentId: student.user.id, startTime: new Date(Date.now() - 86_400_000), endTime: new Date(Date.now() - 82_800_000), status: "COMPLETED", price: 100 },
      })
    }
    const t = await newSession(browser, teacher.email)
    await t.page.goto("/teach/earnings")
    await expect(t.page.getByTestId("available-balance")).toHaveText("$170.00", { timeout: 20_000 })

    // client-side validation messages come from the API
    await t.page.getByTestId("payout-amount").fill("120")
    await t.page.getByTestId("payout-iban").fill("TR00 1234")
    await t.page.getByTestId("payout-account-name").fill(tname)
    await t.page.getByTestId("payout-submit").click()
    await expect(t.page.getByRole("alert").filter({ hasText: "IBAN" })).toBeVisible()

    await t.page.getByTestId("payout-iban").fill("TR33 0006 1005 1978 6457 8413 26")
    await t.page.getByTestId("payout-submit").click()
    await expect(t.page.getByText("Talebiniz alındı")).toBeVisible()
    await expect(t.page.getByTestId("available-balance")).toHaveText("$50.00")
    await expect(t.page.getByTestId("payout-history-item").first()).toContainText("Beklemede")

    // second request, to be rejected
    await t.page.getByTestId("payout-amount").fill("40")
    await t.page.getByTestId("payout-submit").click()
    await expect(t.page.getByTestId("payout-history-item")).toHaveCount(2, { timeout: 15_000 })

    const a = await newSession(browser, admin.email)
    await a.page.goto("/admin?tab=payouts")
    await expect(a.page.getByRole("heading", { name: /Ödeme Talepleri/ })).toBeVisible()
    const rows = a.page.getByTestId("payout-row").filter({ hasText: tname })
    await expect(rows).toHaveCount(2, { timeout: 15_000 })

    // approve the 120 request → mark paid
    const big = rows.filter({ hasText: "120.00" })
    a.page.once("dialog", (d) => d.accept())
    await big.getByTestId("payout-approve").click()
    await a.page.getByRole("button", { name: "Onaylanan" }).click()
    const approved = a.page.getByTestId("payout-row").filter({ hasText: tname }).filter({ hasText: "120.00" })
    await expect(approved).toContainText("Onaylandı", { timeout: 15_000 })
    a.page.once("dialog", (d) => d.accept())
    await approved.getByTestId("payout-mark-paid").click()
    await a.page.getByRole("button", { name: "Ödenen" }).click()
    await expect(a.page.getByTestId("payout-row").filter({ hasText: "120.00" })).toContainText("Ödendi", { timeout: 15_000 })

    // reject the 40 request with a reason
    await a.page.getByRole("button", { name: "Beklemede" }).click()
    const small = a.page.getByTestId("payout-row").filter({ hasText: tname }).filter({ hasText: "40.00" })
    a.page.once("dialog", (d) => d.accept("IBAN adı uyuşmuyor"))
    await small.getByTestId("payout-reject").click()
    await expect(small).toHaveCount(0, { timeout: 15_000 })

    // teacher sees the outcome and gets the rejected amount back
    await t.page.reload()
    await expect(t.page.getByTestId("available-balance")).toHaveText("$50.00", { timeout: 20_000 })
    await expect(t.page.getByTestId("payout-history-item").filter({ hasText: "120.00" })).toContainText("Ödendi")
    const rejected = t.page.getByTestId("payout-history-item").filter({ hasText: "40.00" })
    await expect(rejected).toContainText("Reddedildi")
    await expect(rejected).toContainText("IBAN adı uyuşmuyor")
    await t.ctx.close(); await a.ctx.close()
  })
})

test.describe("admin panel is Turkish", () => {
  test("tabs, headings and the user search", async ({ browser }) => {
    const admin = await makeAccount("ADMIN", { name: "Yönetici Türkçe" })
    const needleName = `Aranacak Kişi Z${Math.random().toString(36).slice(2, 8)}`
    const needle = await makeAccount("STUDENT", { name: needleName })
    const a = await newSession(browser, admin.email)
    await a.page.goto("/admin")
    const body = await a.page.locator("body").innerText()
    for (const word of ["Genel Bakış", "Başvurular", "Deneme Odaları", "Finans", "Ödeme Talepleri", "İçerikler", "Canlı Oturumlar", "Kullanıcılar", "Raporlar ve Güvenlik"]) {
      expect(body).toContain(word)
    }
    expect(body).not.toMatch(/Pending Applications|Platform Financials|User Management|Welcome to Admin/)
    await a.page.getByRole("button", { name: /Kullanıcılar/ }).click()
    await a.page.getByTestId("admin-user-search").fill(needleName.toLowerCase())
    await expect(a.page.getByText(needleName).first()).toBeVisible()
    await expect(a.page.locator("tbody tr")).toHaveCount(1)
    expect(needle.user.id).toBeTruthy()
    await a.ctx.close()
  })
})

test.describe("articles (admin writes, public reads)", () => {
  test("draft is hidden; publishing shows it in the list and renders the body safely", async ({ browser, page }) => {
    const admin = await makeAccount("ADMIN")
    const a = await newSession(browser, admin.email)
    await a.page.goto("/admin?tab=articles")
    await a.page.getByTestId("new-article").click()
    const title = `E2E Yazısı ${Date.now()}`
    await a.page.getByTestId("article-title-input").fill(title)
    await a.page.getByPlaceholder("https://…").first().fill("") // no cover
    await a.page.locator("textarea").first().fill("Bu yazı otomatik testle oluşturuldu ve en az yirmi karakterlik bir özet içeriyor.")
    await a.page.getByTestId("article-body-input").fill("## Başlık Bir\n\nBirinci paragraf burada duruyor ve yeterince uzun olması gerekiyor. <script>window.__xss = 1</script>\n\n> Güzel bir alıntı\n\n- madde bir\n- madde iki\n\nSon paragraf için de biraz daha metin ekleyelim ki yüz karakteri rahatça geçsin.")
    await a.page.getByTestId("save-draft").click()
    await expect(a.page.getByTestId("article-row").filter({ hasText: title })).toContainText("Taslak", { timeout: 15_000 })

    await page.goto("/icerikler")
    await expect(page.getByText(title)).toHaveCount(0)

    const row = a.page.getByTestId("article-row").filter({ hasText: title })
    await row.getByRole("button", { name: "Yayınla" }).click()
    await expect(row).toContainText("Yayında", { timeout: 15_000 })

    await page.goto("/icerikler")
    await page.getByTestId("article-card").filter({ hasText: title }).first().click()
    await expect(page.getByTestId("article-title")).toHaveText(title)
    const body = page.getByTestId("article-body")
    await expect(body.locator("h2")).toHaveText("Başlık Bir")
    await expect(body.locator("blockquote")).toContainText("Güzel bir alıntı")
    await expect(body.locator("li")).toHaveCount(2)
    // the <script> text is displayed, never executed
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined()
    await expect(body).toContainText("<script>")
    await a.ctx.close()
  })
})

test.describe("workshops", () => {
  test("teacher creates a free and a paid workshop; student enrols; payment confirmation unlocks the recorded video", async ({ browser }) => {
    const teacher = await makeAccount("TEACHER", { name: "Eğitmen Atölye" })
    const student = await makeAccount("STUDENT", { name: "Öğrenci Atölye" })
    const t = await newSession(browser, teacher.email)
    await t.page.goto("/teach/workshops")
    const form = t.page.getByTestId("workshop-form")
    await expect(async () => {
      if (!(await form.isVisible())) await t.page.getByTestId("new-workshop").click()
      await expect(form).toBeVisible({ timeout: 1500 })
    }).toPass({ timeout: 20_000 })

    const fill = async (title: string, over: { price: string; mode?: "RECORDED"; capacity?: string }) => {
      await form.locator('input[name="title"]').fill(title)
      await form.locator('textarea[name="description"]').fill("Bu atölyede nefes, beden ve zihin birlikte çalışılır; yeni başlayanlar için uygundur.")
      if (over.mode === "RECORDED") {
        await form.getByRole("button", { name: "Kayıtlı" }).click()
        await form.getByPlaceholder("https://… veya dosya yükleyin").fill("https://cdn.example.com/e2e-video.mp4")
      } else {
        await form.getByTestId("workshop-starts").fill(new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 16))
      }
      await form.locator('input[name="priceUsd"]').fill(over.price)
      await form.locator('input[name="capacity"]').fill(over.capacity ?? "5")
      await form.getByTestId("create-workshop").click()
      await t.page.waitForLoadState("networkidle")
    }
    const freeTitle = `Ücretsiz Atölye ${Date.now()}`
    await fill(freeTitle, { price: "0", capacity: "1" })
    await expect(t.page.getByTestId("managed-workshop").filter({ hasText: freeTitle })).toBeVisible({ timeout: 20_000 })
    // the page reloads after creating; retry the click until hydration has happened and the form opens
    await expect(async () => {
      if (!(await form.isVisible())) await t.page.getByTestId("new-workshop").click()
      await expect(form).toBeVisible({ timeout: 1500 })
    }).toPass({ timeout: 20_000 })
    const paidTitle = `Ücretli Kayıtlı ${Date.now()}`
    await fill(paidTitle, { price: "25", mode: "RECORDED" })
    await expect(t.page.getByTestId("managed-workshop").filter({ hasText: paidTitle })).toBeVisible({ timeout: 20_000 })

    // ── student side: free workshop ──
    const s = await newSession(browser, student.email)
    await s.page.goto("/atolyeler")
    await s.page.getByTestId("workshop-card").filter({ hasText: freeTitle }).click()
    await expect(s.page.getByTestId("workshop-title")).toHaveText(freeTitle)
    await s.page.getByTestId("enroll-button").click()
    await expect(s.page.getByTestId("enrolled-confirmed")).toBeVisible({ timeout: 15_000 })

    // the single seat is gone for another student
    const other = await makeAccount("STUDENT")
    const o = await newSession(browser, other.email)
    await o.page.goto(`/atolyeler/${(await db.workshop.findFirst({ where: { title: freeTitle } }))!.slug}`)
    await expect(o.page.getByTestId("enroll-button")).toBeDisabled()
    await expect(o.page.getByTestId("enroll-button")).toContainText("Kontenjan doldu")

    // ── paid recorded workshop: reserve → locked → teacher confirms → video unlocked ──
    const paid = (await db.workshop.findFirst({ where: { title: paidTitle } }))!
    await s.page.goto(`/atolyeler/${paid.slug}`)
    await s.page.getByTestId("enroll-button").click()
    await expect(s.page.getByTestId("enrolled-reserved")).toBeVisible({ timeout: 15_000 })
    await expect(s.page.getByTestId("workshop-video")).toHaveCount(0)

    await t.page.goto("/teach/workshops")
    const managed = t.page.getByTestId("managed-workshop").filter({ hasText: paidTitle })
    await managed.getByRole("button", { name: /Katılımcılar/ }).click()
    await t.page.getByTestId("confirm-payment").click()
    await expect(t.page.getByTestId("participants")).toContainText("Onaylı", { timeout: 15_000 })

    await s.page.reload()
    await expect(s.page.getByTestId("enrolled-confirmed")).toBeVisible()
    await expect(s.page.getByTestId("workshop-video")).toHaveAttribute("src", "https://cdn.example.com/e2e-video.mp4")
    await t.ctx.close(); await s.ctx.close(); await o.ctx.close()
  })

  test("workshop broadcast: enrolled student can join, outsider is locked out", async ({ browser }) => {
    await db.liveRoom.updateMany({ where: { isActive: true }, data: { isActive: false, endedAt: new Date() } })
    const teacher = await makeAccount("TEACHER", { name: "Eğitmen Yayın" })
    const member = await makeAccount("STUDENT", { name: "Üye Öğrenci" })
    const outsider = await makeAccount("STUDENT", { name: "Dışarıdaki" })
    const w = await db.workshop.create({
      data: {
        slug: `e2e-yayin-${Date.now()}`, title: "Canlı Atölye E2E", description: "Canlı atölye yayını için otomatik test açıklaması, yeterince uzun.", category: "Hatha",
        mode: "LIVE", status: "PUBLISHED", teacherId: teacher.teacher!.id, startsAt: new Date(Date.now() + 5 * 60_000), durationMin: 60, capacity: 5, priceUsd: 0,
      },
    })
    await db.workshopEnrollment.create({ data: { workshopId: w.id, userId: member.user.id, status: "CONFIRMED" } })

    const t = await newSession(browser, teacher.email)
    await t.page.goto(`/atolyeler/${w.slug}`)
    await expect(t.page.getByTestId("start-workshop")).toBeVisible()
    await t.page.getByTestId("start-workshop").click()
    await expect(t.page.getByTestId("workshop-banner")).toContainText("Canlı Atölye E2E")
    await expect(t.page.getByTestId("go-live")).toBeEnabled({ timeout: 30_000 })
    await t.page.getByTestId("go-live").click()
    await expect(t.page.getByTestId("studio-live-badge")).toBeVisible({ timeout: 30_000 })

    const m = await newSession(browser, member.email)
    await m.page.goto(`/atolyeler/${w.slug}`)
    await expect(m.page.getByTestId("join-workshop")).toBeVisible({ timeout: 15_000 })
    await m.page.getByTestId("join-workshop").click()
    await expect(m.page.getByTestId("stream-title")).toHaveText("Canlı Atölye E2E", { timeout: 20_000 })
    await expect.poll(async () => m.page.getByTestId("live-video").evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 30_000 }).toBeGreaterThan(0)

    const o = await newSession(browser, outsider.email)
    const room = await db.liveRoom.findFirst({ where: { workshopId: w.id, isActive: true } })
    await o.page.goto(`/live/${room!.id}`)
    await expect(o.page.getByText("yalnızca atölyeye kayıtlı katılımcılara açık")).toBeVisible({ timeout: 15_000 })
    await expect(o.page.getByRole("link", { name: "Atölyeye git" })).toHaveAttribute("href", `/atolyeler/${w.slug}`)
    await expect(o.page.getByTestId("live-video")).toHaveCount(0)

    t.page.once("dialog", (d) => d.accept())
    await t.page.getByTestId("end-stream").click()
    await expect(m.page.getByText("Yayın sona erdi")).toBeVisible({ timeout: 30_000 })
    await t.ctx.close(); await m.ctx.close(); await o.ctx.close()
  })
})
