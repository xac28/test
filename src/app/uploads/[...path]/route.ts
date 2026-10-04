import { NextResponse } from "next/server"
import { createReadStream } from "fs"
import { stat } from "fs/promises"
import path from "path"
import { Readable } from "stream"

export const dynamic = "force-dynamic"

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4", ".webm": "video/webm", ".ogg": "video/ogg", ".mov": "video/quicktime",
}

/**
 * `next start` only serves files that existed in /public when the server booted, so
 * files uploaded at runtime (avatars, teacher videos, certificates) would 404 in
 * production. This route serves them (with Range support for video seeking).
 */
export async function GET(req: Request, { params }: { params: { path: string[] } }) {
  const root = path.resolve(process.cwd(), "public", "uploads")
  const full = path.resolve(root, ...params.path)
  const type = TYPES[path.extname(full).toLowerCase()]
  if (!full.startsWith(root + path.sep) || !type) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  let size: number
  try {
    size = (await stat(full)).size
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const headers: Record<string, string> = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600",
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
