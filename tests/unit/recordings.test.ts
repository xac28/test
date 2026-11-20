import { describe, it, expect, beforeEach, afterEach } from "vitest"
import os from "os"
import path from "path"
import { mkdtemp, rm, readFile, readdir } from "fs/promises"
import {
  canAccessRecording,
  chunkPath,
  isExpired,
  isValidChunkIndex,
  isValidRecordingId,
  mergeChunks,
  pickRecordingMimeType,
  resolveStoredFile,
  retentionExpiry,
  saveChunk,
  recordingDir,
} from "@/lib/recordings"

let tmp: string
beforeEach(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), "aya-rec-"))
  process.env.RECORDINGS_DIR = tmp
})
afterEach(async () => {
  delete process.env.RECORDINGS_DIR
  await rm(tmp, { recursive: true, force: true })
})

const ID = "cm1abcdefghij0123456789"

describe("recording access", () => {
  const rec = { teacherUserId: "t1", studentUserId: "s1" }
  it("allows only the lesson's teacher and student", () => {
    expect(canAccessRecording("t1", rec)).toBe(true)
    expect(canAccessRecording("s1", rec)).toBe(true)
    expect(canAccessRecording("other", rec)).toBe(false)
  })
  it("a live-room recording (no student) is teacher-only, and null never matches", () => {
    const live = { teacherUserId: "t1", studentUserId: null }
    expect(canAccessRecording("t1", live)).toBe(true)
    expect(canAccessRecording("s1", live)).toBe(false)
    expect(canAccessRecording(null as any, live)).toBe(false)
  })
})

describe("retention", () => {
  it("expires exactly 30 days after the start", () => {
    const start = new Date("2026-10-01T10:00:00Z")
    expect(retentionExpiry(start).toISOString()).toBe("2026-10-31T10:00:00.000Z")
  })
  it("isExpired compares against now", () => {
    const rec = { expiresAt: new Date("2026-10-31T10:00:00Z") }
    expect(isExpired(rec, new Date("2026-10-31T09:59:59Z"))).toBe(false)
    expect(isExpired(rec, new Date("2026-10-31T10:00:00Z"))).toBe(true)
  })
})

describe("validation & path safety", () => {
  it("validates ids and indexes", () => {
    expect(isValidRecordingId(ID)).toBe(true)
    expect(isValidRecordingId("../etc/passwd")).toBe(false)
    expect(isValidRecordingId("short")).toBe(false)
    expect(isValidChunkIndex(0)).toBe(true)
    expect(isValidChunkIndex(-1)).toBe(false)
    expect(isValidChunkIndex(1.5)).toBe(false)
    expect(isValidChunkIndex(10_000)).toBe(false)
  })
  it("refuses ids/indexes that could escape the storage root", () => {
    expect(() => recordingDir("../../x")).toThrow()
    expect(() => chunkPath(ID, -3)).toThrow()
  })
  it("resolveStoredFile rejects traversal", () => {
    expect(() => resolveStoredFile("../outside.webm")).toThrow()
    expect(() => resolveStoredFile("/etc/passwd")).toThrow()
    expect(resolveStoredFile(`${ID}/${ID}.webm`).startsWith(tmp)).toBe(true)
  })
  it("picks mp4 only when asked", () => {
    expect(pickRecordingMimeType("video/mp4")).toBe("video/mp4")
    expect(pickRecordingMimeType("video/webm;codecs=vp9")).toBe("video/webm")
    expect(pickRecordingMimeType(undefined)).toBe("video/webm")
  })
})

describe("chunk storage", () => {
  it("merges chunks in order and removes the parts", async () => {
    await saveChunk(ID, 1, Buffer.from("BBB"))
    await saveChunk(ID, 0, Buffer.from("AAA"))
    await saveChunk(ID, 2, Buffer.from("CC"))
    const { filePath, sizeBytes } = await mergeChunks(ID, 3, "video/webm")
    expect(sizeBytes).toBe(8)
    expect((await readFile(path.join(tmp, filePath))).toString()).toBe("AAABBBCC")
    expect(await readdir(recordingDir(ID))).toEqual([`${ID}.webm`])
  })
  it("fails when a chunk is missing", async () => {
    await saveChunk(ID, 0, Buffer.from("AAA"))
    await saveChunk(ID, 2, Buffer.from("CC"))
    await expect(mergeChunks(ID, 3, "video/webm")).rejects.toThrow()
  })
})
