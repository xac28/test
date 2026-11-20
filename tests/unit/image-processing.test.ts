import { describe, it, expect } from "vitest"
import sharp from "sharp"
import { ImageDecodeError, processImage } from "@/lib/image-processing"
import { squareVariant } from "@/lib/image-urls"

const photo = (width: number, height: number, opts: { orientation?: number; exif?: boolean } = {}) => {
  let img = sharp({ create: { width, height, channels: 3, background: { r: 200, g: 140, b: 110 } } }).jpeg()
  if (opts.orientation || opts.exif) {
    img = img.withMetadata({
      ...(opts.orientation ? { orientation: opts.orientation } : {}),
      ...(opts.exif ? { exif: { IFD0: { Make: "TestPhone", Model: "X" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "41/1 0/1 0/1" } } } : {}),
    })
  }
  return img.toBuffer()
}

describe("automatic image treatment on upload", () => {
  it("shrinks a big post photo without changing its shape, and cuts a square tile for the grid", async () => {
    const r = await processImage(await photo(3000, 2000), "post")
    expect([r.width, r.height]).toEqual([1600, 1067])
    const main = await sharp(r.main).metadata()
    expect(main.format).toBe("webp")
    const sq = await sharp(r.square!).metadata()
    expect([sq.width, sq.height, sq.format]).toEqual([720, 720, "webp"])
  })

  it("never blows a small photo up", async () => {
    const r = await processImage(await photo(300, 200), "post")
    expect([r.width, r.height]).toEqual([300, 200])
    const sq = await sharp(r.square!).metadata()
    expect([sq.width, sq.height]).toEqual([200, 200])
  })

  it("stands a sideways phone photo upright and removes camera / GPS metadata", async () => {
    const r = await processImage(await photo(400, 200, { orientation: 6, exif: true }), "post")
    expect([r.width, r.height]).toEqual([200, 400]) // EXIF 6 = rotate 90°
    const m = await sharp(r.main).metadata()
    expect(m.exif).toBeUndefined()
    expect(m.orientation ?? 1).toBe(1)
  })

  it("avatars become a square, products keep their shape; certificates only lose metadata", async () => {
    const a = await processImage(await photo(1200, 800), "avatar")
    expect([a.width, a.height]).toEqual([512, 512])
    expect(a.square).toBeUndefined()
    const p = await processImage(await photo(900, 1200), "product")
    expect([p.width, p.height]).toEqual([900, 1200])
    expect((await sharp(p.square!).metadata()).width).toBe(900)
    const c = await processImage(await photo(2000, 1400, { exif: true }), "certificate")
    expect([c.width, c.height, c.square]).toEqual([2000, 1400, undefined])
    expect((await sharp(c.main).metadata()).exif).toBeUndefined()
  })

  it("refuses files that only look like an image", async () => {
    const fake = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9])
    await expect(processImage(fake, "post")).rejects.toBeInstanceOf(ImageDecodeError)
    await expect(processImage(Buffer.from("<script>alert(1)</script>"), "avatar")).rejects.toBeInstanceOf(ImageDecodeError)
  })

  it("knows which uploads have a square tile", () => {
    expect(squareVariant("/uploads/posts/post-a-1-ff.webp")).toBe("/uploads/posts/post-a-1-ff.sq.webp")
    expect(squareVariant("/uploads/products/product-a-1-ff.webp")).toBe("/uploads/products/product-a-1-ff.sq.webp")
    for (const no of ["/uploads/posts/old.jpg", "/uploads/avatars/a.webp", "/uploads/posts/x.sq.webp", "https://cdn.example/a.webp", null, undefined]) expect(squareVariant(no)).toBeNull()
  })
})
