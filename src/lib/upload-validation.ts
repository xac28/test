/**
 * Upload validation shared by /api/upload and its tests.
 * Magic-byte checks stop a client from labelling an arbitrary file as an image/video.
 */

// Magic byte signatures for common file types
/**
 * Mobile clients report some types differently (React Native names a .jpg "image/jpg",
 * iOS records video as QuickTime .mov). Map those onto the canonical types we validate.
 */
export function normalizeMime(mime: string): string {
  const m = (mime || "").toLowerCase()
  if (m === "image/jpg" || m === "image/pjpeg") return "image/jpeg"
  if (m === "video/x-m4v") return "video/mp4"
  return m
}

export const MAGIC_BYTES: Record<string, number[][]> = {
  "image/jpeg": [[0xFF, 0xD8, 0xFF]],
  "image/png": [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF header (followed by WEBP at offset 8)
  "image/gif": [[0x47, 0x49, 0x46, 0x38]], // GIF8
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
  "video/mp4": [[0x00, 0x00, 0x00]], // ISO-BMFF: 4-byte box size, then a box type (checked below)
  "video/quicktime": [[0x00, 0x00, 0x00]], // iOS .mov — same container family
  "video/webm": [[0x1A, 0x45, 0xDF, 0xA3]], // EBML header
  "video/ogg": [[0x4F, 0x67, 0x67, 0x53]], // OggS
  "audio/mpeg": [[0x49, 0x44, 0x33], [0xFF, 0xFB], [0xFF, 0xF3], [0xFF, 0xF2], [0xFF, 0xE3]], // ID3 tag or an MPEG frame sync
  "audio/mp4": [[0x00, 0x00, 0x00]], // .m4a: ISO-BMFF like mp4 (box name checked below)
  "audio/ogg": [[0x4F, 0x67, 0x67, 0x53]], // OggS
  "audio/wav": [[0x52, 0x49, 0x46, 0x46]], // RIFF (followed by WAVE)
  "audio/webm": [[0x1A, 0x45, 0xDF, 0xA3]], // EBML header
}

export function validateMagicBytes(buffer: ArrayBuffer, declaredMimeType: string): boolean {
  const bytes = new Uint8Array(buffer)
  
  // Minimum file size check
  if (bytes.length < 4) return false

  const signatures = MAGIC_BYTES[declaredMimeType]
  if (!signatures) {
    // Bilinmeyen MIME type'lar için reject
    return false
  }

  return signatures.some(sig => {
    for (let i = 0; i < sig.length; i++) {
      if (bytes[i] !== sig[i]) return false
    }

    // MP4 / MOV: bytes 4..8 must name a known top-level box
    if (declaredMimeType === "video/mp4" || declaredMimeType === "video/quicktime" || declaredMimeType === "audio/mp4") {
      if (bytes.length < 12) return false
      const box = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7])
      return ["ftyp", "moov", "mdat", "wide", "free", "skip"].includes(box)
    }

    if (declaredMimeType === "audio/wav") {
      return bytes.length >= 12 && String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === "WAVE"
    }

    // WebP için ek kontrol: offset 8'de "WEBP" string'i olmalı
    if (declaredMimeType === "image/webp" && bytes.length >= 12) {
      const webpMarker = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11])
      return webpMarker === "WEBP"
    }

    return true
  })
}
