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
    const type = formData.get("type") as string || "certificate" // 'avatar', 'certificate', or 'video'

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    // Validate file type (mobile clients report some types differently — normalise first)
    const mime = normalizeMime(file.type)
    const allowedTypes = type === "avatar"
      ? ["image/jpeg", "image/png", "image/webp"]
      : type === "video"
      ? ["video/mp4", "video/webm", "video/ogg", "video/quicktime"]
      : ["application/pdf", "image/jpeg", "image/png", "image/webp"]

    if (!allowedTypes.includes(mime)) {
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
    if (!validateMagicBytes(bytes, mime)) {
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
    const mimeExt: Record<string, string> = {
      "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "application/pdf": ".pdf",
      "video/mp4": ".mp4", "video/webm": ".webm", "video/ogg": ".ogg", "video/quicktime": ".mov",
    }
    // Phone libraries often hand over names without (or with the wrong) extension: trust the validated type
    const ext = mimeExt[mime] || path.extname(safeOrigName)
    
    // Extension whitelist kontrolü
    const safeExtensions = type === "avatar" 
      ? [".jpg", ".jpeg", ".png", ".webp"]
      : type === "video"
      ? [".mp4", ".webm", ".ogg", ".mov"]
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
