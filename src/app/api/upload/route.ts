import { NextResponse } from "next/server"
import { termsGate } from "@/lib/terms"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_UPLOAD } from "@/lib/rate-limit"
import { resolveUser } from "@/lib/auth-utils"

// ── FIX #9: Magic byte kontrolü eklendi — MIME type taklit koruması ──

// Magic byte signatures for common file types
const MAGIC_BYTES: Record<string, number[][]> = {
  "image/jpeg": [[0xFF, 0xD8, 0xFF]],
  "image/png": [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF header (followed by WEBP at offset 8)
  "image/gif": [[0x47, 0x49, 0x46, 0x38]], // GIF8
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
  "video/mp4": [[0x00, 0x00, 0x00]], // ftyp box starts at offset 4, but first 3 bytes are size
  "video/webm": [[0x1A, 0x45, 0xDF, 0xA3]], // EBML header
  "video/ogg": [[0x4F, 0x67, 0x67, 0x53]], // OggS
}

function validateMagicBytes(buffer: ArrayBuffer, declaredMimeType: string): boolean {
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

    // WebP için ek kontrol: offset 8'de "WEBP" string'i olmalı
    if (declaredMimeType === "image/webp" && bytes.length >= 12) {
      const webpMarker = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11])
      return webpMarker === "WEBP"
    }

    return true
  })
}

// POST /api/upload — Upload a file (certificates, etc.)
export async function POST(req: Request) {
  const blocked = applyRateLimit(req, RATE_LIMIT_UPLOAD)
  if (blocked) return blocked

  try {
    const user = await resolveUser(req)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const termsBlock = termsGate(user)
    if (termsBlock) return termsBlock

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const type = formData.get("type") as string || "certificate" // 'avatar', 'certificate', or 'video'

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = type === "avatar" 
      ? ["image/jpeg", "image/png", "image/webp"]
      : type === "video" 
      ? ["video/mp4", "video/webm", "video/ogg"]
      : ["application/pdf", "image/jpeg", "image/png", "image/webp"]
      
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 })
    }

    // Max sizes
    const maxSize = type === "video" ? 500 * 1024 * 1024 : 10 * 1024 * 1024 // 500MB for video, 10MB otherwise
    if (file.size > maxSize) {
      return NextResponse.json({ error: `File too large. Maximum ${type === "video" ? "500MB" : "10MB"}` }, { status: 400 })
    }

    // Read file bytes
    const bytes = await file.arrayBuffer()

    // Magic byte validation — MIME type spoofing koruması
    if (!validateMagicBytes(bytes, file.type)) {
      return NextResponse.json(
        { error: "File content does not match declared type. Upload rejected for security." }, 
        { status: 400 }
      )
    }

    // Dosya adı sanitization — path traversal koruması
    const safeOrigName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "_")

    // Determine directory
    const folder = type === "avatar" ? "avatars" : type === "video" ? "videos" : "certificates"
    const uploadsDir = path.join(process.cwd(), "public", "uploads", folder)
    await mkdir(uploadsDir, { recursive: true })

    // Generate unique filename (orijinal dosya adı kullanılmıyor, güvenli prefix + timestamp)
    const ext = path.extname(safeOrigName) || (type === "avatar" ? ".jpg" : type === "video" ? ".mp4" : ".pdf")
    
    // Extension whitelist kontrolü
    const safeExtensions = type === "avatar" 
      ? [".jpg", ".jpeg", ".png", ".webp"]
      : type === "video"
      ? [".mp4", ".webm", ".ogg"]
      : [".pdf", ".jpg", ".jpeg", ".png", ".webp"]
    
    if (!safeExtensions.includes(ext.toLowerCase())) {
      return NextResponse.json({ error: "Invalid file extension" }, { status: 400 })
    }

    const prefix = type === "avatar" ? "avatar" : type === "video" ? "video" : "cert"
    const filename = `${prefix}-${user.id}-${Date.now()}${ext.toLowerCase()}`
    const filepath = path.join(uploadsDir, filename)

    // Write file
    await writeFile(filepath, Buffer.from(bytes))

    // Return the public URL path
    const publicUrl = `/uploads/${folder}/${filename}`

    // If it's an avatar, automatically update the user's profile image
    if (type === "avatar") {
      const { db } = await import("@/lib/db")
      await db.user.update({
        where: { id: user.id },
        data: { image: publicUrl }
      })
    }

    return NextResponse.json({ url: publicUrl, filename })
  } catch (error: any) {
    console.error("[UPLOAD_ERROR]", error)
    return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 })
  }
}
