import path from "path"
import { test, expect, makeAccount, newSession, db, confirmDialog } from "./helpers"

const PHOTO = path.join(process.cwd(), "public", "photos", "studio.jpg")
const fixture = () => {
  // any jpg/png in public/photos works; fall back to a tiny PNG when the folder is empty
  try {
    require("fs").accessSync(PHOTO)
    return PHOTO
  } catch {
    return { name: "p.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") }
  }
}

test.describe("community", () => {
  test("a newcomer shares a photo, the admin approves it, people like and comment, notifications arrive", async ({ browser }) => {
    const owner = await makeAccount("STUDENT", { name: "Deniz Yogi" })
    const fan = await makeAccount("STUDENT", { name: "Mert Fan" })
    const admin = await makeAccount("ADMIN")
    const o = await newSession(browser, owner.email)
    const caption = `Sabah güneş selamı ${Math.random().toString(36).slice(2, 6)}`

    // ── composer: live warning, disabled until valid
    await o.page.goto("/community")
    await o.page.getByTestId("composer-open").click()
    await expect(o.page.getByTestId("composer")).toBeVisible()
    await expect(o.page.getByTestId("composer-submit")).toBeDisabled()
    await o.page.getByTestId("composer-file").setInputFiles(fixture() as any)
    await expect(o.page.getByTestId("composer-preview")).toBeVisible()
    await o.page.getByTestId("composer-text").fill("sen tam bir aptalsın")
    await expect(o.page.getByTestId("composer-text-warn")).toContainText("topluluk kurallarına aykırı")
    await expect(o.page.getByTestId("composer-submit")).toBeDisabled()
    await o.page.getByTestId("composer-text").fill("Beni ara: 0532 123 45 67")
    await expect(o.page.getByTestId("composer-text-warn")).toContainText("telefon")
    await o.page.getByTestId("composer-text").fill(caption)
    await expect(o.page.getByTestId("composer-text-warn")).toHaveText("")
    await o.page.screenshot({ path: "test-results/community-composer.png" })
    await o.page.getByTestId("composer-submit").click()
    await expect(o.page.getByTestId("post-notice")).toContainText("onayından sonra")
    // newcomers land on "Paylaşımlarım", pending
    await expect(o.page.getByTestId("post-pending")).toBeVisible()
    const postId = (await db.post.findFirstOrThrow({ where: { authorId: owner.user.id } })).id
    expect((await db.post.findUniqueOrThrow({ where: { id: postId } })).status).toBe("PENDING")

    // not public yet
    const f = await newSession(browser, fan.email)
    await f.page.goto("/community")
    await expect(f.page.getByText(caption)).toHaveCount(0)
    const missing = await f.page.goto(`/community/${postId}`)
    await expect(f.page.getByTestId("post-missing")).toBeVisible()

    // ── admin approves from the new tab
    const a = await newSession(browser, admin.email)
    await a.page.goto("/admin")
    await expect(a.page.getByTestId("nav-community")).toContainText(/\d/) // badge with the pending count
    await a.page.getByTestId("nav-community").click()
    await expect(a.page.getByTestId("tab-community")).toBeVisible()
    await a.page.getByTestId("photo-search").fill(caption)
    const card = a.page.getByTestId("admin-photo").filter({ hasText: caption })
    await expect(card).toBeVisible({ timeout: 15_000 })
    await a.page.screenshot({ path: "test-results/community-admin-queue.png" })
    await card.getByTestId("photo-approve").click()
    await expect(a.page.getByTestId("toast")).toContainText("yayınlandı")
    await expect(a.page.getByTestId("admin-photo").filter({ hasText: caption })).toHaveCount(0)

    // ── the owner is notified (bell + list page)
    await o.page.goto("/community")
    await expect(o.page.getByTestId("bell-count")).toHaveText("1", { timeout: 35_000 })
    await o.page.getByTestId("bell").click()
    await expect(o.page.getByTestId("bell-item").first()).toContainText("yayında")
    await o.page.screenshot({ path: "test-results/community-bell.png" })
    await o.page.getByTestId("bell-item").first().click()
    await expect(o.page).toHaveURL(new RegExp(`/community/${postId}$`))

    // ── a fan likes (optimistic, persisted) and comments; swearing is blocked, polite text goes through
    await f.page.goto("/community")
    // the feed opens as a photo grid (Instagram style): the tile links to the post, the list view shows full cards
    await expect(f.page.locator(`a[href="/community/${postId}"]`).first()).toBeVisible({ timeout: 15_000 })
    await f.page.getByRole("button", { name: "Liste görünüm" }).click()
    const fcard = f.page.getByTestId("post-card").filter({ hasText: caption })
    await expect(fcard).toBeVisible({ timeout: 15_000 })
    await fcard.getByTestId("like-btn").click()
    await expect(fcard.getByTestId("like-count")).toHaveText("1")
    await expect(fcard.getByTestId("like-btn")).toHaveAttribute("aria-pressed", "true")
    await f.page.reload()
    await f.page.getByRole("button", { name: "Liste görünüm" }).click()
    await expect(f.page.getByTestId("post-card").filter({ hasText: caption }).getByTestId("like-btn")).toHaveAttribute("aria-pressed", "true")

    await f.page.goto(`/community/${postId}`)
    await expect(f.page.getByTestId("no-comments")).toBeVisible()
    await f.page.getByTestId("comment-input").fill("s.i.k.t.i.r")
    await expect(f.page.getByTestId("comment-input-warn")).toContainText("topluluk kurallarına aykırı")
    await expect(f.page.getByTestId("comment-submit")).toBeDisabled()
    // the server blocks even when the page-side check is bypassed
    const bypass = await f.page.evaluate(async (id) => {
      const r = await fetch(`/api/community/${id}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: "$1kt1r git" }) })
      return { status: r.status, body: await r.json() }
    }, postId)
    expect(bypass.status, JSON.stringify(bypass.body)).toBe(422)
    expect(JSON.stringify(bypass.body)).not.toMatch(/sikt|1kt1r/i)
    await f.page.getByTestId("comment-input").fill("Çok huzur verici bir kare, teşekkürler 🙏")
    await f.page.getByTestId("comment-submit").click()
    await expect(f.page.getByTestId("comment")).toHaveCount(1)
    await expect(f.page.getByTestId("comments-total")).toHaveText("(1)")
    await f.page.screenshot({ path: "test-results/community-detail.png", fullPage: true })

    // ── the owner sees merged like + comment notifications
    await o.page.goto("/dashboard/notifications")
    const rows = o.page.getByTestId("notification-row")
    await expect(rows).toHaveCount(3) // approved, like, comment
    await expect(rows.filter({ hasText: "fotoğrafını beğendi" })).toBeVisible()
    await expect(rows.filter({ hasText: "yorum yaptı" })).toBeVisible()
    await o.page.screenshot({ path: "test-results/community-notifications.png" })
    await o.page.getByTestId("mark-all-page").click()
    await expect(o.page.getByTestId("mark-all-page")).toBeDisabled()
    await o.page.reload()
    await expect(o.page.getByTestId("bell-count")).toHaveCount(0)

    // ── the fan reports the photo → admin removes it from the report drawer
    await f.page.goto(`/community/${postId}`)
    await f.page.getByTestId("report-post").first().click()
    const dlg = f.page.getByTestId("report-dialog")
    await dlg.getByTestId("report-cat-INAPPROPRIATE_CONTENT").check()
    await dlg.getByTestId("report-description").fill("Bu fotoğraf topluluk kurallarına uygun görünmüyor, lütfen inceleyin.")
    await dlg.getByTestId("report-submit").click()
    await expect(dlg.getByTestId("report-done")).toBeVisible({ timeout: 15_000 })

    await a.page.goto("/admin?tab=reports")
    await a.page.getByTestId("report-search").fill(owner.email)
    await expect(a.page.getByTestId("report-row")).toHaveCount(1)
    await a.page.getByTestId("report-row").filter({ hasText: "Topluluk fotoğrafı" }).click()
    const drawer = a.page.getByTestId("report-drawer")
    await expect(drawer.getByTestId("report-content-evidence")).toContainText(caption)
    await drawer.getByTestId("act-remove-content").click()
    await confirmDialog(a.page, "Kurallara aykırı")
    await expect(drawer.getByTestId("report-closed-info")).toContainText("İçerik kaldırıldı")
    expect((await db.post.findUniqueOrThrow({ where: { id: postId } })).status).toBe("REMOVED")
    await o.page.goto("/community?x=1")
    await o.page.getByTestId("feed-mine").click()
    await expect(o.page.getByTestId("post-removed")).toBeVisible()

    await o.ctx.close(); await f.ctx.close(); await a.ctx.close()
  })

  test("the rules page explains the system, the filter tester works and the navbar links to it", async ({ browser }) => {
    const admin = await makeAccount("ADMIN")
    const a = await newSession(browser, admin.email)
    await a.page.goto("/community/rules")
    await expect(a.page.getByRole("heading", { name: /Otomatik denetim nasıl çalışır/ })).toBeVisible()
    await a.page.screenshot({ path: "test-results/community-rules.png", fullPage: true })
    await expect(a.page.getByRole("navigation", { name: "Ana menü" }).getByRole("link", { name: "Topluluk" })).toBeVisible()

    await a.page.goto("/admin?tab=community")
    await a.page.getByTestId("community-section-filter").click()
    await a.page.getByTestId("filter-sample").fill("sen tam bir salaksın")
    await a.page.getByTestId("filter-test").click()
    await expect(a.page.getByTestId("filter-result")).toContainText("Engellenir")
    await a.page.getByTestId("filter-sample").fill("Harika bir ders, teşekkürler")
    await a.page.getByTestId("filter-test").click()
    await expect(a.page.getByTestId("filter-result")).toContainText("Temiz")
    const word = `ekkelime${Math.random().toString(36).slice(2, 7).replace(/\d/g, "x")}`
    await a.page.getByTestId("word-input").fill(word)
    await a.page.getByTestId("word-add").click()
    await expect(a.page.getByTestId("word-list")).toContainText(word)
    await a.page.screenshot({ path: "test-results/community-admin-filter.png", fullPage: true })
    await a.ctx.close()
  })

  test("phones: the feed has no horizontal scroll and the composer is usable", async ({ browser }) => {
    const u = await makeAccount("STUDENT")
    const s = await newSession(browser, u.email)
    await s.page.setViewportSize({ width: 390, height: 800 })
    await s.page.goto("/community")
    await s.page.getByTestId("composer-open").click()
    await expect(s.page.getByTestId("composer")).toBeVisible()
    const overflow = await s.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    await s.page.screenshot({ path: "test-results/community-mobile.png" })
    await s.ctx.close()
  })
})
