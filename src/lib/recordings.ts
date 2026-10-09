import path from "path"
import { createReadStream, createWriteStream } from "fs"
import { mkdir, rm, stat, writeFile } from "fs/promises"
import { pipeline } from "stream/promises"
import { RECORDING_RETENTION_DAYS } from "@/lib/terms"

/** Largest single chunk the API accepts (MediaRecorder timeslice chunks are a few MB). */
export const MAX_CHUNK_BYTES = 32 * 1024 * 1024
/** Hard cap on chunks per recording: 5 s chunks → ~14 hours. */
export const MAX_CHUNKS = 10_000

const ID_PATTERN = /^[a-z0-9]{10,40}$/i

/**
 * Recordings live OUTSIDE `public/` so the only way to get one is the
 * authenticated download endpoint.
 */
export function recordingsRoot(): string {
  return process.env.RECORDINGS_DIR || path.join(process.cwd(), "storage", "recordings")
}

export function isValidRecordingId(id: string): boolean {
  return ID_PATTERN.test(id)
}

export function isValidChunkIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < MAX_CHUNKS
}

export function recordingDir(id: string): string {
  if (!isValidRecordingId(id)) throw new Error("Invalid recording id")
  return path.join(recordingsRoot(), id)
}

export function chunkPath(id: string, index: number): string {
  if (!isValidChunkIndex(index)) throw new Error("Invalid chunk index")
  return path.join(recordingDir(id), `chunk-${String(index).padStart(6, "0")}.part`)
}

export function mergedFileName(id: string, mimeType: string): string {
  return `${id}.${mimeType.includes("mp4") ? "mp4" : "webm"}`
}

/** Expiry timestamp: lesson start + 30 days. */
export function retentionExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + RECORDING_RETENTION_DAYS * 24 * 60 * 60 * 1000)
}

export function isExpired(rec: { expiresAt: Date | string }, now: Date = new Date()): boolean {
  return new Date(rec.expiresAt).getTime() <= now.getTime()
}

/** Only the teacher and the student of that lesson may download — nobody else, admins included. */
export function canAccessRecording(
  userId: string,
  rec: { teacherUserId: string; studentUserId: string | null }
): boolean {
  return userId === rec.teacherUserId || (!!rec.studentUserId && userId === rec.studentUserId)
}

export function pickRecordingMimeType(requested: unknown): string {
  return typeof requested === "string" && requested.startsWith("video/mp4") ? "video/mp4" : "video/webm"
}

export async function saveChunk(id: string, index: number, data: Buffer): Promise<void> {
  await mkdir(recordingDir(id), { recursive: true })
  await writeFile(chunkPath(id, index), data)
}

/**
 * Concatenate chunk-000000 … chunk-(count-1) into one file. MediaRecorder timeslice
 * chunks are slices of a single continuous container stream, so plain concatenation
 * yields a valid file. Fails if a chunk is missing (the upload was incomplete).
 */
export async function mergeChunks(
  id: string,
  count: number,
  mimeType: string
): Promise<{ filePath: string; sizeBytes: number }> {
  const dir = recordingDir(id)
  const fileName = mergedFileName(id, mimeType)
  const out = createWriteStream(path.join(dir, fileName))
  try {
    for (let i = 0; i < count; i++) {
      const p = chunkPath(id, i)
      await stat(p) // throws ENOENT when a chunk is missing
      await pipeline(createReadStream(p), out, { end: false })
    }
  } finally {
    await new Promise<void>((resolve) => out.end(resolve))
  }
  for (let i = 0; i < count; i++) {
    await rm(chunkPath(id, i), { force: true })
  }
  const { size } = await stat(path.join(dir, fileName))
  return { filePath: path.join(id, fileName), sizeBytes: size }
}

/** Resolve a stored relative file path, refusing anything that escapes the root. */
export function resolveStoredFile(relativePath: string): string {
  const root = path.resolve(recordingsRoot())
  const full = path.resolve(root, relativePath)
  if (!full.startsWith(root + path.sep)) throw new Error("Invalid recording path")
  return full
}

export async function purgeRecordingFiles(id: string): Promise<void> {
  await rm(recordingDir(id), { recursive: true, force: true })
}
