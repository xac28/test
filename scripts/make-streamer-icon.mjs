// Builds the Windows icon of the desktop streaming app from the site's own logo (src/app/icon.svg):
//   node scripts/make-streamer-icon.mjs   →   streamer/build/icon.ico (16–256 px) + streamer/build/icon.png
// Small sizes are stored as classic BMP frames (what the NSIS installer expects), 128/256 px as PNG frames.
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import sharp from "sharp"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const svg = fs.readFileSync(path.join(root, "src/app/icon.svg"))
const outDir = path.join(root, "streamer/build")
fs.mkdirSync(outDir, { recursive: true })

const render = (size) => sharp(svg, { density: Math.ceil((72 * size) / 64) * 2 }).resize(size, size).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const renderPng = (size) => sharp(svg, { density: Math.ceil((72 * size) / 64) * 2 }).resize(size, size).png().toBuffer()

function bmpFrame(size, rgba) {
  const header = Buffer.alloc(40)
  header.writeUInt32LE(40, 0)
  header.writeInt32LE(size, 4)
  header.writeInt32LE(size * 2, 8) // height counts the XOR and the AND mask
  header.writeUInt16LE(1, 12)
  header.writeUInt16LE(32, 14)
  const xor = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const s = ((size - 1 - y) * size + x) * 4 // bottom-up rows, BGRA
      const d = (y * size + x) * 4
      xor[d] = rgba[s + 2]; xor[d + 1] = rgba[s + 1]; xor[d + 2] = rgba[s]; xor[d + 3] = rgba[s + 3]
    }
  }
  const maskRow = Math.ceil(size / 32) * 4
  return Buffer.concat([header, xor, Buffer.alloc(maskRow * size)])
}

const frames = []
for (const size of [16, 24, 32, 48, 64]) {
  const { data } = await render(size)
  frames.push({ size, data: bmpFrame(size, data) })
}
for (const size of [128, 256]) frames.push({ size, data: await renderPng(size) })

const dir = Buffer.alloc(6 + frames.length * 16)
dir.writeUInt16LE(1, 2) // type: icon
dir.writeUInt16LE(frames.length, 4)
let offset = dir.length
frames.forEach((f, i) => {
  const e = 6 + i * 16
  dir[e] = f.size >= 256 ? 0 : f.size
  dir[e + 1] = f.size >= 256 ? 0 : f.size
  dir.writeUInt16LE(1, e + 4)
  dir.writeUInt16LE(32, e + 6)
  dir.writeUInt32LE(f.data.length, e + 8)
  dir.writeUInt32LE(offset, e + 12)
  offset += f.data.length
})
fs.writeFileSync(path.join(outDir, "icon.ico"), Buffer.concat([dir, ...frames.map((f) => f.data)]))
fs.writeFileSync(path.join(outDir, "icon.png"), await renderPng(512))
console.log(`wrote ${path.join(outDir, "icon.ico")} (${frames.map((f) => f.size).join(", ")} px)`)
