import { test, makeAccount, newSession } from "./helpers"
import fs from "fs"

test.skip(!process.env.SHOTS, "set SHOTS=1")
const dir = process.env.SHOTS_DIR || "/tmp/shots"

test("site pages", async ({ browser }) => {
  fs.mkdirSync(dir, { recursive: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.addInitScript(() => { try { localStorage.setItem("namaste-locale", "tr") } catch {} })
  const pages = (process.env.PAGES || "/,/teachers,/pricing,/login,/become-teacher,/terms").split(",")
  for (const p of pages) {
    await page.goto(p)
    await page.waitForTimeout(1200)
    const name = p === "/" ? "home" : p.replace(/\//g, "_").replace(/^_/, "")
    await page.screenshot({ path: `${dir}/site-${name}.png`, fullPage: process.env.FULL === "1" })
  }
  await ctx.close()
  if (process.env.AUTHED) {
    const student = await makeAccount("STUDENT", { name: "Öğrenci Ayşe" })
    const teacher = await makeAccount("TEACHER", { name: "Eğitmen Deniz" })
    const admin = await makeAccount("ADMIN", { name: "Yönetici" })
    for (const [acc, paths] of [[student, ["/dashboard"]], [teacher, ["/teach", "/teach/earnings"]], [admin, ["/admin", "/admin?tab=payouts"]]] as const) {
      const { ctx, page } = await newSession(browser, acc.email)
      for (const p of paths) {
        await page.goto(p)
        await page.waitForTimeout(1800)
        await page.screenshot({ path: `${dir}/authed-${p.replace(/[\/?=]/g, "_")}.png` })
      }
      await ctx.close()
    }
  }
})
