import { NextResponse } from "next/server"
import { PRIVATE_UPLOAD_FOLDERS, serveUpload } from "@/lib/serve-upload"

export const dynamic = "force-dynamic"

/**
 * Private documents (diplomas, ID). Their public address stays /uploads/certificates/…; the proxy rewrites it here
 * before Next.js could serve a copy from /public, and serveUpload only answers the owner and administrators.
 */
export async function GET(req: Request, props: { params: Promise<{ path: string[] }> }) {
  const segments = (await props.params).path
  if (!PRIVATE_UPLOAD_FOLDERS.has(segments[0])) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return serveUpload(req, segments)
}
