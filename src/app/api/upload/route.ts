import { logEvent } from "@/lib/event-log"
import { NextResponse } from "next/server"
import { termsGate } from "@/lib/terms"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_UPLOAD } from "@/lib/rate-limit"
import { resolveUser } from "@/lib/auth-utils"
import { normalizeMime, validateMagicBytes } from "@/lib/upload-validation"

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
    const type = formData.get("type") as string || "certificate" // 'avatar', 'certificate', 'video', 'post', 'audio' or 'product'

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    // podcast audio and shop pictures are site content: only admins publish those
    if ((type === "audio" || type === "product") && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Validate file type (mobile clients report some types differently — normalise first)
    const mime = normalizeMime(file.type)
    const allowedTypes = type === "avatar" || type === "post" || type === "product"
      ? ["image/jpeg", "image/png", "image/webp"]
      : type === "audio"
      ? ["audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav", "audio/webm"]
      : type === "video"
      ? ["video/mp4", "video/webm", "video/ogg", "video/quicktime"]
      : ["application/pdf", "image/jpeg", "image/png", "image/webp"]

    if (!allowedTypes.includes(mime)) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 })
    }

    // Max sizes
    const maxMb = type === "video" ? 500 : type === "audio" ? 200 : 10
    if (file.size > maxMb * 1024 * 1024) {
      return NextResponse.json({ error: `File too large. Maximum ${maxMb}MB` }, { status: 400 })
    }

    // Read file bytes
    const bytes = await file.arrayBuffer()

    // Magic byte validation — MIME type spoofing koruması
    if (!validateMagicBytes(bytes, mime)) {
      return NextResponse.json(
        { error: "File content does not match declared type. Upload rejected for security." }, 
        { status: 400 }
      )
    }

    // Dosya adı sanitization — path traversal koruması
    const safeOrigName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "_")

    // Determine directory
    const folder = type === "avatar" ? "avatars" : type === "post" ? "posts" : type === "video" ? "videos" : type === "audio" ? "audio" : type === "product" ? "products" : "certificates"
    const uploadsDir = path.join(process.cwd(), "public", "uploads", folder)
    await mkdir(uploadsDir, { recursive: true })

    // Generate unique filename (orijinal dosya adı kullanılmıyor, güvenli prefix + timestamp)
    const mimeExt: Record<string, string> = {
      "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "application/pdf": ".pdf",
      "video/mp4": ".mp4", "video/webm": ".webm", "video/ogg": ".ogg", "video/quicktime": ".mov",
      "audio/mpeg": ".mp3", "audio/mp4": ".m4a", "audio/ogg": ".ogg", "audio/wav": ".wav", "audio/webm": ".weba",
    }
    // Phone libraries often hand over names without (or with the wrong) extension: trust the validated type
    const ext = mimeExt[mime] || path.extname(safeOrigName)
    
    // Extension whitelist kontrolü
    const safeExtensions = type === "avatar" || type === "post" || type === "product"
      ? [".jpg", ".jpeg", ".png", ".webp"]
      : type === "audio"
      ? [".mp3", ".m4a", ".ogg", ".wav", ".weba"]
      : type === "video"
      ? [".mp4", ".webm", ".ogg", ".mov"]
      : [".pdf", ".jpg", ".jpeg", ".png", ".webp"]
    
    if (!safeExtensions.includes(ext.toLowerCase())) {
      return NextResponse.json({ error: "Invalid file extension" }, { status: 400 })
    }

    const prefix = type === "avatar" ? "avatar" : type === "post" ? "post" : type === "video" ? "video" : type === "audio" ? "audio" : type === "product" ? "product" : "cert"
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

    logEvent({ type: "UPLOAD", message: `Yükleme: ${type} (${Math.round(bytes.byteLength / 1024)} KB)`, userId: user.id, meta: { url: publicUrl, mime } })
    return NextResponse.json({ url: publicUrl, filename })
  } catch (error: any) {
    console.error("[UPLOAD_ERROR]", error)
    return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 })
  }
}
