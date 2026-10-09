// Renders the yoga pose library (public/poses/<slug>.webp) from the rigged character with three.js.
//   node scripts/render-poses/render.mjs [slug]
// Needs: ffmpeg (png → webp over a soft gradient) and the Chromium that Playwright uses in this repo.
import { build } from "esbuild"
import { chromium } from "@playwright/test"
import { createServer } from "http"
import { execFileSync } from "child_process"
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs"
import path from "path"

const root = process.cwd()
const only = process.argv[2]
const outDir = path.join(root, "public", "poses")
mkdirSync(outDir, { recursive: true })

const bundle = path.join(root, "scripts", "render-poses", ".bundle.js")
await build({
  entryPoints: [path.join(root, "scripts", "render-poses", "entry.ts")], bundle: true, format: "esm", outfile: bundle, logLevel: "error",
  external: ["three", "three/addons/*"], alias: { "@": path.join(root, "src") },
})

const types = { ".js": "text/javascript", ".html": "text/html", ".glb": "model/gltf-binary", ".json": "application/json" }
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x").pathname
  let file
  if (url === "/") { res.setHeader("content-type", "text/html"); return res.end(`<!doctype html><body style="margin:0"><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script><script type="module" src="/bundle.js"></script>`) }
  if (url === "/bundle.js") file = bundle
  else if (url.startsWith("/three/")) file = path.join(root, "node_modules", url)
  else if (url.startsWith("/models/")) file = path.join(root, "public", url)
  if (!file || !existsSync(file)) { res.statusCode = 404; return res.end() }
  res.setHeader("content-type", types[path.extname(file)] || "application/octet-stream")
  res.end(readFileSync(file))
})
await new Promise((r) => server.listen(0, r))
const port = server.address().port

const exe = existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] })
const page = await browser.newPage({ viewport: { width: 900, height: 1125 } })
page.on("pageerror", (e) => console.log("pageerror", e.message))
await page.goto(`http://localhost:${port}/${only ? `?only=${only}` : ""}`)
await page.waitForFunction("window.done", null, { timeout: 240000 })
const err = await page.evaluate("window.error")
if (err) throw new Error(err)
const results = await page.evaluate("window.results")
await browser.close()
server.close()

// a soft peach → mint backdrop with a faint glow behind the figure, then webp
const bg = path.join(outDir, ".bg.png")
execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "gradients=s=900x1125:c0=0xFCE6DC:c1=0xD6ECE9:x0=0:y0=0:x1=900:y1=1125:n=2:type=linear:d=1", "-frames:v", "1", bg])
for (const [slug, data] of Object.entries(results)) {
  const png = path.join(outDir, `.${slug}.png`)
  writeFileSync(png, Buffer.from(data.split(",")[1], "base64"))
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", bg, "-i", png, "-filter_complex", "[0][1]overlay=0:0", "-c:v", "libwebp", "-quality", "86", "-frames:v", "1", path.join(outDir, `${slug}.webp`)])
  execFileSync("rm", ["-f", png])
  console.log("poses/" + slug + ".webp")
}
execFileSync("rm", ["-f", bg, bundle])
