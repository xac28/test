import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { isValidRecordingId, isValidChunkIndex, saveChunk, MAX_CHUNK_BYTES } from "@/lib/recordings"

// PUT /api/recordings/:id/chunks/:index — upload one MediaRecorder chunk (idempotent per index)
export async function PUT(req: Request, { params }: { params: { id: string; index: string } }) {
  try {
    const user = await resolveUser(req)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const index = Number(params.index)
    if (!isValidRecordingId(params.id) || !isValidChunkIndex(index)) {
      return NextResponse.json({ error: "Geçersiz kayıt veya parça" }, { status: 400 })
    }

    const recording = await db.lessonRecording.findUnique({ where: { id: params.id } })
    if (!recording) return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 })
    if (recording.teacherUserId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (recording.status !== "RECORDING") {
      return NextResponse.json({ error: "Kayıt artık yüklemeye açık değil" }, { status: 409 })
    }

    const declared = Number(req.headers.get("content-length") || 0)
    if (declared > MAX_CHUNK_BYTES) {
      return NextResponse.json({ error: "Parça çok büyük" }, { status: 413 })
    }
    const data = Buffer.from(await req.arrayBuffer())
    if (data.length === 0) return NextResponse.json({ error: "Boş parça" }, { status: 400 })
    if (data.length > MAX_CHUNK_BYTES) {
      return NextResponse.json({ error: "Parça çok büyük" }, { status: 413 })
    }

    await saveChunk(recording.id, index, data)
    await db.lessonRecording.update({
      where: { id: recording.id },
      data: { chunkCount: Math.max(recording.chunkCount, index + 1) },
    })

    return NextResponse.json({ success: true, index, bytes: data.length })
  } catch (error) {
    console.error("[RECORDING_CHUNK_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
