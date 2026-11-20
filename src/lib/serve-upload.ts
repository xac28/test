import { NextResponse } from "next/server"
import { createReadStream } from "fs"
import { stat } from "fs/promises"
import path from "path"
import { Readable } from "stream"
import { resolveUser } from "@/lib/auth-utils"

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4", ".webm": "video/webm", ".ogg": "video/ogg", ".mov": "video/quicktime",
  ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".wav": "audio/wav", ".weba": "audio/webm",
}

/** Folders whose files are personal documents (diplomas, ID): never under /public, only through serveUpload's check. */
export const PRIVATE_UPLOAD_FOLDERS = new Set(["certificates"])

/** Where private uploads live: outside /public, so the static file handler can never hand them out. */
export const privateUploadsRoot = () => path.resolve(process.env.PRIVATE_UPLOADS_DIR || path.join(process.cwd(), "storage", "private-uploads"))
export const publicUploadsRoot = () => path.resolve(process.cwd(), "public", "uploads")

/** Directory to write a new upload of this folder into. */
export const uploadDirFor = (folder: string) => path.join(PRIVATE_UPLOAD_FOLDERS.has(folder) ? privateUploadsRoot() : publicUploadsRoot(), folder)

const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 })

/**
 * Streams an uploaded file (with Range support for video seeking). Private folders are checked first: only the person
 * who uploaded the file (their id is part of the name) and administrators may open it; everyone else gets a 404.
 */
export async function serveUpload(req: Request, segments: string[]): Promise<Response> {
  const isPrivate = PRIVATE_UPLOAD_FOLDERS.has(segments[0])
  const roots = isPrivate ? [privateUploadsRoot(), publicUploadsRoot()] : [publicUploadsRoot()] // older private files may still sit under /public
  const name = path.basename(segments[segments.length - 1] || "")
  const type = TYPES[path.extname(name).toLowerCase()]
  if (!type) return notFound()

  if (isPrivate) {
    const owner = name.split("-")[1]
    const viewer = await resolveUser(req)
    if (!viewer || (viewer.role !== "ADMIN" && viewer.id !== owner)) return notFound()
  }

  let full = ""
  let size = -1
  for (const root of roots) {
    const candidate = path.resolve(root, ...segments)
    if (!candidate.startsWith(root + path.sep)) return notFound() // path traversal
    try {
      size = (await stat(candidate)).size
      full = candidate
      break
    } catch {}
  }
  if (!full) return notFound()

  const headers: Record<string, string> = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    // Every upload gets a brand-new filename (userId + timestamp + random, see /api/upload) — this exact
    // URL will never point at different content, so public files can be cached for a full year.
    "Cache-Control": isPrivate ? "private, no-store" : "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    // user-uploaded files must never run as pages
    "Content-Security-Policy": "default-src 'none'; sandbox",
  }

  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") || "")
  if (range && (range[1] || range[2])) {
    let start = range[1] ? parseInt(range[1], 10) : size - parseInt(range[2], 10)
    let end = range[1] && range[2] ? parseInt(range[2], 10) : size - 1
    start = Math.max(0, start)
    end = Math.min(size - 1, end)
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } })
    }
    return new Response(Readable.toWeb(createReadStream(full, { start, end })) as ReadableStream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    })
  }

  return new Response(Readable.toWeb(createReadStream(full)) as ReadableStream, {
    headers: { ...headers, "Content-Length": String(size) },
  })
}
