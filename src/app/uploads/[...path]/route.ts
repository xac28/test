import { serveUpload } from "@/lib/serve-upload"

export const dynamic = "force-dynamic"

/**
 * `next start` only serves files that existed in /public when the server booted, so
 * files uploaded at runtime (avatars, teacher videos, podcast audio, product pictures) would 404 in
 * production. This route serves them (with Range support for video seeking).
 * Private documents (/uploads/certificates/…) never reach this route: the proxy sends them to
 * /api/private-uploads, which checks who is asking (see lib/serve-upload).
 */
export async function GET(req: Request, props: { params: Promise<{ path: string[] }> }) {
  return serveUpload(req, (await props.params).path)
}
