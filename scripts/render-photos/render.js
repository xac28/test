// node scripts/render-photos/render.js  → writes public/photos/{hero,studio,meditation,join,breath}.jpg
// Needs a local static server for /node_modules (started here) and Chromium (PLAYWRIGHT_BROWSERS_PATH or /opt/pw-browsers).
const http = require("http"), fs = require("fs"), path = require("path")
const { chromium } = require("playwright-core")
const root = path.resolve(__dirname, "../..")
const out = path.join(root, "public/photos")
fs.mkdirSync(out, { recursive: true })
const types = { ".js": "text/javascript", ".html": "text/html" }
const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0]
  const file = url === "/" ? path.join(__dirname, "index.html") : url.startsWith("/scene.js") ? path.join(__dirname, "scene.js") : path.join(root, url)
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); return res.end() }
  res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" }); fs.createReadStream(file).pipe(res)
})
server.listen(8123, async () => {
  const exe = fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined
  const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] })
  const page = await browser.newPage({ viewport: { width: 2000, height: 1250 } })
  page.on("pageerror", (e) => console.error("PAGEERR", e.message))
  await page.goto("http://localhost:8123/")
  const names = await page.evaluate(() => window.__names)
  for (const n of names) {
    const data = await page.evaluate((name) => window.__render(name), n)
    fs.writeFileSync(path.join(out, `${n}.jpg`), Buffer.from(data.split(",")[1], "base64"))
    console.log("wrote", n, Math.round(fs.statSync(path.join(out, `${n}.jpg`)).size / 1024) + " kB")
    await page.evaluate(() => document.querySelectorAll("canvas").forEach((c) => c.remove()))
  }
  await browser.close(); server.close()
})
