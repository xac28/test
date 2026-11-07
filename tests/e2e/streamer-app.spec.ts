import { _electron as electron } from "@playwright/test"
import fs from "fs"
import os from "os"
import path from "path"
import { test, expect, makeAccount, db } from "./helpers"
import { hashSecret, newPairCode } from "../../src/lib/streamer"

// The real desktop app (Electron) driven against the running server. Skipped where Electron isn't installed.
const ELECTRON = path.join(process.cwd(), "streamer", "node_modules", "electron", "dist", "electron")
const SERVER = process.env.AYA_TEST_URL || "http://localhost:3000"

test.describe("desktop streaming app (Electron)", () => {
  test.skip(!fs.existsSync(ELECTRON), "streamer/node_modules not installed")
  test.skip(!process.env.AYA_STREAMER_E2E, "needs a display and a secret service: run scripts/run-streamer-e2e.sh")

  test("pairs with a code, opens the teacher's own studio, keeps the token encrypted, refuses to leave the server, signs out", async () => {
    test.setTimeout(120_000)
    const teacher = await makeAccount("TEACHER", { name: "Masaüstü Eğitmeni" })
    const userData = fs.mkdtempSync(path.join(os.tmpdir(), "aya-app-"))
    const app = await electron.launch({
      executablePath: ELECTRON,
      args: [path.join(process.cwd(), "streamer"), "--no-sandbox", "--password-store=gnome-libsecret", `--user-data-dir=${userData}`],
      env: { ...process.env, AYA_SERVER_URL: SERVER, XDG_CURRENT_DESKTOP: "GNOME" },
    })
    try {
      const win = await app.firstWindow()
      await expect(win.locator("#code")).toBeVisible({ timeout: 30_000 })
      await expect(win.locator("#server")).toHaveValue(SERVER)

      // a wrong code is refused with a message, nothing is stored
      await win.fill("#code", "ZZZZ-ZZZZ")
      await win.click("#go")
      await expect(win.locator("#error")).toBeVisible({ timeout: 15_000 })
      expect(fs.existsSync(path.join(userData, "aya-device.json"))).toBe(false)

      // an insecure server address is refused before any request is made
      await win.click("summary")
      await win.fill("#server", "http://evil.example.com")
      await win.fill("#code", "ZZZZ-ZZZZ")
      await win.click("#go")
      await expect(win.locator("#error")).toContainText("https")
      await win.fill("#server", SERVER)

      // the real code from the teacher's panel (made here straight in the DB)
      const code = newPairCode()
      await db.streamerPairing.create({ data: { userId: teacher.user.id, codeHash: hashSecret(code), expiresAt: new Date(Date.now() + 600_000) } })
      await win.fill("#code", code.toLowerCase())
      await win.click("#go")
      await expect.poll(() => win.url(), { timeout: 30_000 }).toContain("/live/studio")
      await expect(win.getByTestId("go-live")).toBeVisible({ timeout: 30_000 })
      // it is this teacher's studio
      const cookies = await app.evaluate(({ session }) => session.defaultSession.cookies.get({}))
      expect(cookies.some((c: any) => /session-token/.test(c.name) && c.httpOnly)).toBe(true)

      // the device token is on disk only encrypted, and a device row exists
      const device = await db.streamerDevice.findMany({ where: { userId: teacher.user.id } })
      expect(device).toHaveLength(1)
      const raw = fs.readFileSync(path.join(userData, "aya-device.json"))
      expect(raw.toString("latin1")).not.toContain("ayas_")
      expect(raw.toString("latin1")).not.toContain("token")

      // the website in the window gets no bridge to the app, and cannot navigate away
      expect(await win.evaluate(() => typeof (window as any).ayaStreamer)).toBe("undefined")
      await win.evaluate(() => { location.href = "https://evil.example.com/" }).catch(() => {})
      await win.waitForTimeout(1500)
      expect(new URL(win.url()).origin).toBe(new URL(SERVER).origin)
      await win.evaluate(() => { window.open("http://evil.example.com/") })
      await win.waitForTimeout(500)
      expect(app.windows()).toHaveLength(1)

      // "remove this computer's connection" in the menu: device revoked on the server, file gone, back to the pairing screen
      await app.evaluate(({ Menu }) => { Menu.getApplicationMenu()!.items[0].submenu!.items[1].click() })
      await expect(win.locator("#code")).toBeVisible({ timeout: 20_000 })
      expect(fs.existsSync(path.join(userData, "aya-device.json"))).toBe(false)
      await expect.poll(async () => (await db.streamerDevice.findMany({ where: { userId: teacher.user.id } }))[0]?.revokedAt != null).toBe(true)
    } finally {
      await app.close().catch(() => {})
      fs.rmSync(userData, { recursive: true, force: true })
    }
  })
})
