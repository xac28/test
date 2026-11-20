/**
 * Automatic treatment of every uploaded photo, so pictures look right everywhere without the uploader doing anything:
 *  - turned upright from the camera's EXIF orientation (phone photos otherwise lie on their side)
 *  - EXIF / GPS and other metadata removed (privacy: a phone photo carries where it was taken)
 *  - scaled down to a sensible size for its use, never up, never stretched — the aspect ratio is kept
 *  - saved as WebP (much smaller than JPEG/PNG at the same quality)
 *  - where a square tile is shown (community grid, shop cards, avatars) a square version is cut around
 *    the part of the picture with the most detail ("entropy" strategy: it kept whole bodies in portrait poses where "attention" locked onto a busy wall), not blindly from the centre
 * A file that is not a decodable image is refused: the magic-byte check alone lets polyglot files through.
 */
import sharp, { type Metadata } from "sharp"

export type ImageKind = "avatar" | "post" | "product" | "certificate"

const SPEC: Record<ImageKind, { max: number; square?: number; squareOnly?: boolean; quality: number }> = {
  avatar: { max: 512, square: 512, squareOnly: true, quality: 82 },
  post: { max: 1600, square: 720, quality: 82 },
  product: { max: 1600, square: 900, quality: 85 },
  // documents for the admins: readable, upright and without metadata, but not shrunk much
  certificate: { max: 2400, quality: 88 },
}

export interface ProcessedImage {
  main: Buffer
  /** square cut for tiles (absent for certificates; for avatars `main` is already square) */
  square?: Buffer
  width: number
  height: number
}

export class ImageDecodeError extends Error {}

export async function processImage(input: Buffer | ArrayBuffer, kind: ImageKind): Promise<ProcessedImage> {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input)
  const spec = SPEC[kind]
  let meta: Metadata
  try {
    // limitInputPixels guards against "decompression bombs" (a tiny file that decodes to gigapixels)
    meta = await sharp(buf, { limitInputPixels: 80_000_000 }).metadata()
    if (!meta.width || !meta.height) throw new Error("no dimensions")
  } catch {
    throw new ImageDecodeError("Görsel okunamadı. Lütfen geçerli bir JPG, PNG ya da WEBP fotoğraf seçin.")
  }

  const base = () => sharp(buf, { limitInputPixels: 80_000_000, failOn: "error" }).rotate() // rotate() with no angle = EXIF orientation; metadata is dropped by default

  if (spec.squareOnly) {
    const { data, info } = await base()
      .resize(spec.square, spec.square, { fit: "cover", position: sharp.strategy.entropy, withoutEnlargement: false })
      .webp({ quality: spec.quality })
      .toBuffer({ resolveWithObject: true })
    return { main: data, width: info.width, height: info.height }
  }

  const { data, info } = await base()
    .resize(spec.max, spec.max, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: spec.quality })
    .toBuffer({ resolveWithObject: true })

  let square: Buffer | undefined
  if (spec.square) {
    const side = Math.min(spec.square, info.width, info.height) // a small photo is not blown up
    square = await base()
      .resize(side, side, { fit: "cover", position: sharp.strategy.entropy })
      .webp({ quality: spec.quality })
      .toBuffer()
  }
  return { main: data, square, width: info.width, height: info.height }
}
