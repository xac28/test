import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { createReadStream } from "fs"
import { stat } from "fs/promises"
import { Readable } from "stream"
import { resolveUser } from "@/lib/auth-utils"
import {
  canAccessRecording,
  isExpired,
  isValidRecordingId,
  purgeRecordingFiles,
  resolveStoredFile,
} from "@/lib/recordings"

export const dynamic = "force-dynamic"

// GET /api/recordings/:id/download — only the teacher and the student of that lesson
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await resolveUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!isValidRecordingId(params.id)) {
      return NextResponse.json({ error: "Geçersiz kayıt" }, { status: 400 })
    }

    const recording = await db.lessonRecording.findUnique({ where: { id: params.id } })
    // Same answer for "missing" and "not yours" so ids cannot be probed
    if (!recording || !canAccessRecording(user.id, recording)) {
      return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 })
    }

    if (recording.status !== "READY" || recording.deletedAt || !recording.filePath) {
      return NextResponse.json({ error: "Kayıt hazır değil veya silinmiş" }, { status: 404 })
    }

    if (isExpired(recording)) {
      // Lazy purge — the cron job does this too
      await purgeRecordingFiles(recording.id).catch(() => {})
      await db.lessonRecording.update({
        where: { id: recording.id },
        data: { status: "EXPIRED", deletedAt: new Date(), filePath: null },
      })
      return NextResponse.json({ error: "Kayıt süresi doldu (30 gün)" }, { status: 410 })
    }

    const fullPath = resolveStoredFile(recording.filePath)
    const { size } = await stat(fullPath)
    const ext = recording.mimeType.includes("mp4") ? "mp4" : "webm"
    const day = recording.startedAt.toISOString().slice(0, 10)

    return new Response(Readable.toWeb(createReadStream(fullPath)) as ReadableStream, {
      headers: {
        "Content-Type": recording.mimeType,
        "Content-Length": String(size),
        "Content-Disposition": `attachment; filename="AYA-Ders-Kaydi-${day}.${ext}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    console.error("[RECORDING_DOWNLOAD_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
