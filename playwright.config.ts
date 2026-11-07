import { defineConfig } from "@playwright/test"
import fs from "fs"

// Chromium is pre-installed in this environment; never download another one.
const executablePath = fs.existsSync("/opt/pw-browsers/chromium")
  ? "/opt/pw-browsers/chromium"
  : undefined

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.AYA_TEST_URL || "http://localhost:3000",
    headless: true,
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      executablePath,
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        "--autoplay-policy=no-user-gesture-required",
        "--no-sandbox",
      ],
    },
    permissions: ["camera", "microphone"],
    screenshot: "only-on-failure",
    trace: "off",
  },
  outputDir: "test-results",
})
