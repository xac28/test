import { Browser, BrowserContext, Page, expect, test } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { readFileSync } from "fs"
import path from "path"

try {
  for (const line of readFileSync(path.join(process.cwd(), ".env"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
} catch {}

export const db = new PrismaClient()
const tag = () => crypto.randomBytes(4).toString("hex")
export const PASSWORD = "Passw0rd!"

export async function makeAccount(role: "STUDENT" | "TEACHER" | "ADMIN", opts: { terms?: boolean; name?: string } = {}) {
  const { CURRENT_TERMS_VERSION } = await import("../../src/lib/terms")
  const email = `e2e-${tag()}@aya.test`
  const user = await db.user.create({
    data: {
      name: opts.name ?? `${role === "TEACHER" ? "Eğitmen" : role === "ADMIN" ? "Yönetici" : "Öğrenci"} ${tag()}`,
      email,
      password: await bcrypt.hash(PASSWORD, 4),
      role,
      profileCompleted: true,
      ...(opts.terms === false ? {} : { termsAcceptedAt: new Date(), termsVersion: CURRENT_TERMS_VERSION }),
    },
  })
  let teacher = null
  if (role === "TEACHER") {
    teacher = await db.teacher.create({ data: { userId: user.id, bio: "e2e", hourlyRate: 40, isTrialMode: false } })
  }
  return { user, teacher, email, password: PASSWORD }
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login")
  await page.getByPlaceholder("E-posta adresi").fill(email)
  await page.getByPlaceholder("Şifre").fill(password)
  await page.locator("form button[type=submit]").click()
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 })
}

export async function newSession(browser: Browser, email: string): Promise<{ ctx: BrowserContext; page: Page }> {
  // every simulated visitor gets its own address: the API rate-limits per IP and all browsers here come from localhost
  const ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`
  const ctx = await browser.newContext({ permissions: ["camera", "microphone"], viewport: { width: 1440, height: 900 }, extraHTTPHeaders: { "x-forwarded-for": ip }, ...(process.env.AYA_RECORD_DIR ? { recordVideo: { dir: process.env.AYA_RECORD_DIR, size: { width: 1280, height: 800 } } } : {}) })
  const page = settleAfterGoto(await ctx.newPage())
  await login(page, email)
  return { ctx, page }
}

/**
 * React 19 reveals late Suspense segments in batches (up to ~300 ms after the page's load event); until then the hidden copy
 * of the content is still in the DOM and strict test-id lookups see two elements. After every navigation we wait for that to end.
 */
export function settleAfterGoto(page: Page): Page {
  const goto = page.goto.bind(page)
  ;(page as any).goto = async (...args: Parameters<Page["goto"]>) => {
    const res = await goto(...args)
    await page.waitForFunction(() => !document.querySelector('[hidden][id^="S:"]'), null, { timeout: 5000 }).catch(() => {})
    return res
  }
  return page
}

const base = test
const extended = base.extend({
  page: async ({ page }, use) => {
    settleAfterGoto(page)
    await use(page)
  },
})
export { expect, extended as test }


/** Answers the in-app confirmation dialog (replaces window.confirm/prompt in the admin panel). */
export async function confirmDialog(page: import("@playwright/test").Page, text?: string) {
  const dlg = page.getByTestId("confirm-dialog")
  await dlg.waitFor({ timeout: 10_000 })
  if (text !== undefined) await dlg.getByTestId("confirm-input").fill(text)
  await dlg.getByTestId("confirm-ok").click()
  await dlg.waitFor({ state: "detached", timeout: 15_000 })
}
