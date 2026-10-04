import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { isValidRecordingId, mergeChunks, purgeRecordingFiles } from "@/lib/recordings"

// POST /api/recordings/:id/finalize — teacher ends the recording; chunks are merged into one file
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await resolveUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!isValidRecordingId(params.id)) {
      return NextResponse.json({ error: "Geçersiz kayıt" }, { status: 400 })
    }

    const recording = await db.lessonRecording.findUnique({ where: { id: params.id } })
    if (!recording) return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 })
    if (recording.teacherUserId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (recording.status === "READY") {
      return NextResponse.json({ success: true, alreadyFinalized: true })
    }
    if (recording.status !== "RECORDING") {
      return NextResponse.json({ error: "Kayıt tamamlanamaz" }, { status: 409 })
    }

    const body = await req.json().catch(() => ({}))
    const expectedChunks = Number.isInteger(body.chunkCount) ? Number(body.chunkCount) : recording.chunkCount
    const durationSec = Number.isFinite(body.durationSec) ? Math.max(0, Math.round(body.durationSec)) : null

    if (expectedChunks <= 0) {
      await db.lessonRecording.update({
        where: { id: recording.id },
        data: { status: "FAILED", endedAt: new Date() },
      })
      await purgeRecordingFiles(recording.id)
      return NextResponse.json({ error: "Kayıtta veri yok" }, { status: 400 })
    }

    try {
      const merged = await mergeChunks(recording.id, expectedChunks, recording.mimeType)
      await db.lessonRecording.update({
        where: { id: recording.id },
        data: {
          status: "READY",
          chunkCount: expectedChunks,
          filePath: merged.filePath,
          sizeBytes: BigInt(merged.sizeBytes),
          durationSec,
          endedAt: new Date(),
        },
      })
      return NextResponse.json({ success: true, id: recording.id, sizeBytes: merged.sizeBytes })
    } catch (err) {
      console.error("[RECORDING_MERGE_ERROR]", err)
      await db.lessonRecording.update({
        where: { id: recording.id },
        data: { status: "FAILED", endedAt: new Date() },
      })
      await purgeRecordingFiles(recording.id)
      return NextResponse.json({ error: "Kayıt birleştirilemedi (eksik parça)" }, { status: 422 })
    }
  } catch (error) {
    console.error("[RECORDING_FINALIZE_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
