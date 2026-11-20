import { test, expect, makeAccount, login, PASSWORD } from "./helpers"

test.describe("security in the browser", () => {
  test("the sign-in form locks an account after repeated wrong passwords, from any address", async ({ browser }) => {
    const victim = await makeAccount("STUDENT")
    const tryLogin = async (password: string) => {
      // each attempt comes from a fresh visitor with a new address, like a distributed guesser
      const ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`
      const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": ip } })
      const page = await ctx.newPage()
      await page.goto("/login")
      await page.getByPlaceholder("E-posta adresi").fill(victim.email)
      await page.getByPlaceholder("Şifre").fill(password)
      await page.locator("form button[type=submit]").click()
      await page.waitForTimeout(1200)
      const signedIn = !new URL(page.url()).pathname.startsWith("/login")
      await ctx.close()
      return signedIn
    }
    for (let i = 0; i < 10; i++) expect(await tryLogin("wrong-" + i)).toBe(false)
    // the account is locked now: even the correct password does not get in
    expect(await tryLogin(PASSWORD)).toBe(false)
  })

  test("a signed-in student cannot open admin or teacher areas, and anonymous visitors are sent away", async ({ browser, page }) => {
    for (const p of ["/admin", "/teach", "/dashboard", "/live/studio"]) {
      await page.goto(p)
      expect(new URL(page.url()).pathname, `anonymous ${p}`).not.toBe(p)
    }
    const s = await makeAccount("STUDENT")
    const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `10.8.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}` } })
    const sp = await ctx.newPage()
    await login(sp, s.email)
    for (const p of ["/admin", "/teach", "/teach/earnings", "/live/studio"]) {
      await sp.goto(p)
      expect(new URL(sp.url()).pathname, `student ${p}`).not.toBe(p)
    }
    await ctx.close()
  })

  test("user-supplied text is shown as text, not executed", async ({ browser }) => {
    const author = await makeAccount("STUDENT", { name: `<img src=x onerror="window.__xss=1"> Z` })
    const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `10.9.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}` } })
    const page = await ctx.newPage()
    await login(page, author.email)
    for (const p of ["/dashboard", "/dashboard/profile", "/community", "/messages"]) {
      await page.goto(p)
      await page.waitForTimeout(400)
      expect(await page.evaluate(() => (window as any).__xss), `xss on ${p}`).toBeUndefined()
    }
    await ctx.close()
  })

  test("security headers are present on pages", async ({ request }) => {
    const res = await request.get("/")
    const h = res.headers()
    expect(h["x-frame-options"]).toBe("DENY")
    expect(h["x-content-type-options"]).toBe("nosniff")
    expect(h["referrer-policy"]).toBeTruthy()
    expect(h["permissions-policy"]).toContain("camera=self")
    expect(h["content-security-policy"] || h["content-security-policy-report-only"]).toContain("frame-ancestors")
    expect(h["x-powered-by"]).toBeUndefined()
  })
})
