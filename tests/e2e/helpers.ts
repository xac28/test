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
  const page = await ctx.newPage()
  await login(page, email)
  return { ctx, page }
}

export { expect, test }


/** Answers the in-app confirmation dialog (replaces window.confirm/prompt in the admin panel). */
export async function confirmDialog(page: import("@playwright/test").Page, text?: string) {
  const dlg = page.getByTestId("confirm-dialog")
  await dlg.waitFor({ timeout: 10_000 })
  if (text !== undefined) await dlg.getByTestId("confirm-input").fill(text)
  await dlg.getByTestId("confirm-ok").click()
  await dlg.waitFor({ state: "detached", timeout: 15_000 })
}
