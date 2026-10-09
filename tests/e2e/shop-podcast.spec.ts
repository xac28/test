import path from "path"
import { test, expect, makeAccount, newSession, db, confirmDialog } from "./helpers"

const uid = () => Math.random().toString(36).slice(2, 7)
const MP3 = path.join(process.cwd(), "tests/fixtures/tone.mp3")

test.describe("shop", () => {
  test("admin lists a product, a visitor buys it with the cart, the admin takes the order to the door", async ({ browser }) => {
    test.setTimeout(150_000)
    const admin = await makeAccount("ADMIN")
    const a = await newSession(browser, admin.email)
    const name = `E2E bardak ${uid()}`
    const mail = `e2e-buyer-${uid()}@aya.test`
    let productId = ""
    try {
      // ── the admin adds a product (published at once)
      await a.page.goto("/admin?tab=products")
      await expect(a.page.getByTestId("tab-products")).toBeVisible()
      await a.page.getByTestId("product-new").click()
      await a.page.getByTestId("product-publish").click()
      await expect(a.page.getByTestId("product-error")).toBeVisible() // empty form is refused
      await a.page.getByTestId("product-name").fill(name)
      await a.page.getByTestId("product-summary").fill("Seramik, elde üretilmiş bir çay bardağı.")
      await a.page.getByTestId("product-description").fill("Pratikten sonra içilecek çay için elde üretilmiş, dayanıklı seramik bardak. Bulaşık makinesinde yıkanabilir.")
      await a.page.getByTestId("product-cat").selectOption("wellness")
      await a.page.getByTestId("product-price").fill("150,50")
      await a.page.getByTestId("product-stock").fill("2")
      await a.page.getByTestId("product-publish").click()
      await expect(a.page.getByTestId("product-drawer")).toHaveCount(0)
      const row = a.page.getByTestId("product-row").filter({ hasText: name })
      await expect(row).toBeVisible()
      productId = (await db.product.findFirstOrThrow({ where: { name } })).id

      // ── a visitor finds it, adds it to the cart and checks out as a guest
      const vctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, extraHTTPHeaders: { "x-forwarded-for": `10.7.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}` } })
      const v = await vctx.newPage()
      await v.goto("/shop")
      await expect(v.getByTestId("shop-cat-wellness")).toContainText("ürün")
      await v.goto("/shop/wellness")
      await v.getByTestId("product-card").filter({ hasText: name }).click()
      await expect(v.getByTestId("product-name")).toHaveText(name)
      await expect(v.getByTestId("product-price")).toContainText("150,50")
      await v.getByTestId("add-to-cart").click()
      await expect(v.getByTestId("added-note")).toBeVisible()
      await expect(v.getByTestId("nav-cart")).toContainText("1")
      await v.goto("/shop/sepet")
      await expect(v.getByTestId("cart-line")).toHaveCount(1)
      await v.getByRole("button", { name: "Artır" }).click()
      await expect(v.getByTestId("cart-qty")).toHaveText("2")
      await expect(v.getByRole("button", { name: "Artır" })).toBeDisabled() // only 2 in stock
      await expect(v.getByTestId("cart-subtotal")).toContainText("301")
      await v.getByTestId("to-checkout").click()
      await v.getByTestId("co-name").fill("Ayşe Yılmaz")
      await v.getByTestId("co-email").fill(mail)
      await v.getByTestId("co-phone").fill("0532 111 22 33")
      await v.getByTestId("co-city").fill("İzmir / Karşıyaka")
      await v.getByTestId("co-address").fill("Bostanlı mah. Deniz sok. No 5 Daire 3")
      await v.getByTestId("co-submit").click()
      await v.waitForURL(/\/shop\/siparis\/AYA-/, { timeout: 30_000 })
      const code = v.url().split("/").pop()!
      await expect(v.getByTestId("order-status")).toHaveAttribute("data-status", "PENDING_PAYMENT")
      await expect(v.getByTestId("bank-info")).toContainText(code)
      await expect(v.getByTestId("nav-cart")).toHaveCount(0) // the cart was emptied
      expect((await db.product.findUniqueOrThrow({ where: { id: productId } })).stock).toBe(0)

      // sold out now: no cart button, an e-mail form instead
      await v.goto(`/shop/urun/${(await db.product.findUniqueOrThrow({ where: { id: productId } })).slug}`)
      await expect(v.getByTestId("product-soldout")).toBeVisible()
      await expect(v.getByTestId("add-to-cart")).toHaveCount(0)

      // ── the admin confirms the payment and ships it
      await a.page.goto("/admin?tab=orders")
      await a.page.getByTestId("order-search").fill(code)
      await a.page.getByTestId("order-row").filter({ hasText: code }).click()
      await a.page.getByTestId("order-to-SHIPPED").count().then((n) => expect(n).toBe(0)) // not before the payment
      await a.page.getByTestId("order-to-PAID").click()
      await expect(a.page.getByTestId("order-to-SHIPPED")).toBeVisible()
      await a.page.getByTestId("order-to-SHIPPED").click() // no tracking number yet
      await expect(a.page.getByTestId("order-to-SHIPPED")).toBeVisible()
      expect((await db.order.findUniqueOrThrow({ where: { code } })).status).toBe("PAID")
      await a.page.getByTestId("order-tracking").fill("PTT-998877")
      await a.page.getByTestId("order-to-SHIPPED").click()
      await expect.poll(async () => (await db.order.findUniqueOrThrow({ where: { code } })).status).toBe("SHIPPED")
      await v.goto(`/shop/siparis/${code}`)
      await expect(v.getByTestId("tracking-no")).toHaveText("PTT-998877")
      await expect(v.getByTestId("order-status")).toHaveAttribute("data-status", "SHIPPED")
      await vctx.close()
    } finally {
      await db.order.deleteMany({ where: { email: mail } })
      if (productId) await db.product.deleteMany({ where: { id: productId } })
      await a.ctx.close()
    }
  })

  test("cancelling in the admin panel returns the stock; the order badge counts open orders", async ({ browser }) => {
    const admin = await makeAccount("ADMIN")
    const a = await newSession(browser, admin.email)
    const p = await db.product.create({ data: { slug: `e2e-${uid()}`, name: `E2E mum ${uid()}`, summary: "Soya mumu, lavanta kokulu.", description: "Soya mumu, lavanta kokulu; yaklaşık 40 saat yanar.", category: "aromaterapi", priceKurus: 20000, stock: 3, images: "[]", status: "PUBLISHED" } })
    const mail = `e2e-cancel-${uid()}@aya.test`
    try {
      const res = await a.page.request.post("/api/shop/orders", { data: { name: "Test Kişi", email: mail, phone: "05321112233", address: "Test mah. Test sok. No 1 D 1", city: "Bursa", payMethod: "havale", items: [{ productId: p.id, quantity: 2 }] }, headers: { "x-forwarded-for": `10.8.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}` } })
      expect(res.status()).toBe(200)
      const { code } = await res.json()
      expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(1)
      await a.page.goto("/admin?tab=orders")
      await expect(a.page.getByTestId("nav-orders")).toContainText(/[1-9]/) // badge with open orders
      await a.page.getByTestId("order-search").fill(code)
      await a.page.getByTestId("order-row").filter({ hasText: code }).click()
      await a.page.getByTestId("order-cancel").click()
      await confirmDialog(a.page)
      await expect.poll(async () => (await db.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(3)
      expect((await db.order.findUniqueOrThrow({ where: { code } })).status).toBe("CANCELLED")
    } finally {
      await db.order.deleteMany({ where: { email: mail } })
      await db.product.deleteMany({ where: { id: p.id } })
      await a.ctx.close()
    }
  })
})

test.describe("podcast", () => {
  test("admin uploads audio and publishes an episode; visitors listen and the RSS feed carries it", async ({ browser }) => {
    test.setTimeout(120_000)
    const admin = await makeAccount("ADMIN")
    const a = await newSession(browser, admin.email)
    const title = `E2E sohbeti ${uid()}`
    try {
      await a.page.goto("/admin?tab=podcast")
      await expect(a.page.getByTestId("tab-podcast")).toBeVisible()
      await a.page.getByTestId("episode-new").click()
      await a.page.getByTestId("episode-publish").click()
      await expect(a.page.getByTestId("episode-error")).toBeVisible() // nothing filled in yet
      await a.page.getByTestId("episode-title").fill(title)
      await a.page.getByTestId("episode-description").fill("Bu bölümde nefes çalışmasının günlük hayata etkisini konuşuyoruz; yeni başlayanlar için ipuçları da var.")
      await a.page.getByTestId("episode-guest").fill("Deniz Aksoy")
      await a.page.getByTestId("episode-audio-file").setInputFiles(MP3)
      await expect(a.page.getByTestId("episode-audio-url")).toHaveValue(/\/uploads\/audio\/audio-.*\.mp3$/, { timeout: 30_000 })
      await expect(a.page.getByTestId("episode-duration")).toHaveValue(/^[1-3]$/, { timeout: 15_000 }) // the 2 s tone is measured in the browser
      await a.page.getByTestId("episode-notify").check()
      await a.page.getByTestId("episode-publish").click()
      await expect(a.page.getByTestId("episode-drawer")).toHaveCount(0)
      await expect(a.page.getByTestId("episode-row").filter({ hasText: title })).toContainText("Yayında")
      const ep = await db.podcastEpisode.findFirstOrThrow({ where: { title } })
      expect(ep.notifiedAt).toBeTruthy() // subscribers were told (or, without SMTP, the attempt was logged)

      const vctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, extraHTTPHeaders: { "x-forwarded-for": `10.6.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}` } })
      const v = await vctx.newPage()
      await v.goto("/podcast")
      const card = v.getByTestId("episode-card").filter({ hasText: title })
      await expect(card).toBeVisible()
      await expect(card).toContainText("Deniz Aksoy")
      await expect(v.getByTestId("podcast-rss")).toHaveAttribute("href", "/podcast/feed.xml")
      await card.getByRole("link", { name: title }).click()
      await expect(v).toHaveURL(new RegExp(`/podcast/${ep.slug}$`))
      await expect(v.locator("h1")).toHaveText(title)
      const audio = v.getByTestId("podcast-audio")
      await expect(audio).toBeVisible()
      await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.src.includes("/uploads/audio/"))).toBe(true)
      await audio.evaluate((el: HTMLAudioElement) => { el.muted = true; return el.play().catch(() => {}) })
      await expect.poll(async () => (await db.podcastEpisode.findUniqueOrThrow({ where: { id: ep.id } })).plays, { timeout: 15_000 }).toBe(1)
      const feed = await v.request.get("/podcast/feed.xml")
      expect(await feed.text()).toContain(title)
      // the uploaded file is really served (with range support for seeking)
      const part = await v.request.get(ep.audioUrl, { headers: { range: "bytes=0-99" } })
      expect(part.status()).toBe(206)
      expect(part.headers()["content-type"]).toBe("audio/mpeg")
      await vctx.close()

      // unpublish → gone from the public page
      await a.page.getByTestId("episode-row").filter({ hasText: title }).getByTestId("episode-toggle").click()
      await expect.poll(async () => (await db.podcastEpisode.findUniqueOrThrow({ where: { id: ep.id } })).status).toBe("DRAFT")
      expect((await a.page.request.get(`/podcast/${ep.slug}`)).status()).toBe(404)
    } finally {
      const ep = await db.podcastEpisode.findFirst({ where: { title } })
      if (ep) {
        await db.newsletterCampaign.deleteMany({ where: { refId: ep.id } })
        await db.podcastEpisode.delete({ where: { id: ep.id } })
      }
      await a.ctx.close()
    }
  })
})

test.describe("newsletter", () => {
  test("a visitor subscribes, the admin sees and mails them, the mail's link unsubscribes", async ({ browser }) => {
    test.setTimeout(120_000)
    const admin = await makeAccount("ADMIN")
    const a = await newSession(browser, admin.email)
    const mail = `e2e-news-${uid()}@aya.test`
    const subject = `Test kampanya ${uid()}`
    try {
      const vctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, extraHTTPHeaders: { "x-forwarded-for": `10.5.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}` } })
      const v = await vctx.newPage()
      await v.goto("/podcast")
      await v.getByTestId("newsletter-email").fill(mail)
      await v.getByTestId("newsletter-submit").click()
      await expect(v.getByTestId("newsletter-done")).toBeVisible()

      await a.page.goto("/admin?tab=newsletter")
      await expect(a.page.getByTestId("tab-newsletter")).toBeVisible()
      await a.page.getByTestId("nl-search").fill(mail)
      await expect(a.page.getByTestId("subscriber-row")).toHaveCount(1)
      await expect(a.page.getByTestId("subscriber-row")).toContainText("Aktif")

      await a.page.getByTestId("nl-subject").fill(subject)
      await a.page.getByTestId("nl-body").fill("Merhaba! Yeni atölyelerimiz yayında.\n\nGörüşmek üzere.")
      await a.page.getByTestId("nl-send").click()
      await confirmDialog(a.page)
      await expect(a.page.getByTestId("campaign-row").filter({ hasText: subject })).toBeVisible({ timeout: 30_000 })

      // the link every mail carries
      const sub = await db.newsletterSubscriber.findUniqueOrThrow({ where: { email: mail } })
      await v.goto(`/bulten/ayril?t=${sub.unsubscribeToken}`)
      await v.getByTestId("unsub-confirm").click()
      await expect(v.getByTestId("unsub-done")).toBeVisible()
      await v.goto("/bulten/ayril?t=bozuk-baglanti-bozuk-baglanti")
      await v.getByTestId("unsub-confirm").click()
      await expect(v.getByTestId("unsub-error")).toBeVisible()

      await a.page.getByTestId("nl-status-unsub").click()
      await expect(a.page.getByTestId("subscriber-row").filter({ hasText: mail })).toContainText("Ayrıldı")
      await a.page.getByTestId("subscriber-row").filter({ hasText: mail }).getByTestId("subscriber-delete").click()
      await confirmDialog(a.page)
      await expect.poll(() => db.newsletterSubscriber.count({ where: { email: mail } })).toBe(0)
      await vctx.close()
    } finally {
      await db.newsletterSubscriber.deleteMany({ where: { email: mail } })
      await db.newsletterCampaign.deleteMany({ where: { subject } })
      await a.ctx.close()
    }
  })
})

test.describe("menu destinations", () => {
  test("every item of the main menu leads to a working page", async ({ browser }) => {
    test.setTimeout(150_000)
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, extraHTTPHeaders: { "x-forwarded-for": `10.4.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}` } })
    const page = await ctx.newPage()
    const errors: string[] = []
    page.on("pageerror", (e) => errors.push(e.message))
    const targets: [string, string][] = [
      ["/shop", "Pratiğinize"], ["/shop/wellness", "Wellness"], ["/shop/matlar", "Matlar"], ["/shop/aromaterapi", "Aromaterapi"],
      ["/yoga-stilleri", "Yoga"], ["/pozlar", "Poz"], ["/teachers", "Eğitmen"],
      ["/icerikler", "Tümü"], ["/icerikler?category=Sa%C4%9Fl%C4%B1k", "Sağlık"], ["/icerikler?category=Beslenme", "Beslenme"], ["/icerikler?category=Hareket", "Hareket"], ["/icerikler?category=Ki%C5%9Fisel%20Geli%C5%9Fim", "Kişisel Gelişim"], ["/icerikler?category=Bak%C4%B1m", "Bakım"],
      ["/dersler/kayit", "kayıt"], ["/atolyeler?mode=LIVE", "Canlı"], ["/atolyeler?mode=RECORDED", "Kayıtlı"],
      ["/podcast", "Konuşmalar"], ["/duyurular", "Duyuru"], ["/community", "Topluluk"],
    ]
    for (const [url, text] of targets) {
      const res = await page.goto(url)
      expect(res?.status(), url).toBe(200)
      await expect(page.locator("body"), url).toContainText(new RegExp(text, "i"))
      await expect(page.locator("h1").first(), url).toBeVisible()
    }
    // "Dersler > Canlı" is for members: visitors are sent to sign in and come back
    await page.goto("/live")
    await expect(page).toHaveURL(/login/)
    // recordings page for a visitor and for a signed-in student
    await page.goto("/dersler/kayit")
    await expect(page.getByTestId("recordings-login")).toBeVisible()
    const stu = await makeAccount("STUDENT")
    const s = await newSession(browser, stu.email)
    await s.page.goto("/dersler/kayit")
    await expect(s.page.getByTestId("recordings-section")).toBeVisible()
    await expect(s.page.getByTestId("recordings-login")).toHaveCount(0)
    await s.ctx.close()
    expect(errors).toEqual([])
    await ctx.close()
  })

  test("the main menu's dropdown links are the ones in the sketch", async ({ page }) => {
    await page.goto("/")
    await page.getByTestId("nav-toggle-dersler").click()
    const panel = page.getByTestId("nav-panel-dersler")
    await expect(panel.locator('a[href="/live"]')).toBeVisible()
    await expect(panel.locator('a[href="/dersler/kayit"]')).toBeVisible()
    await page.getByTestId("nav-toggle-podcast").click()
    await page.getByTestId("nav-panel-podcast").locator('a[href="/podcast"]').click()
    await expect(page).toHaveURL(/\/podcast$/)
  })
})
