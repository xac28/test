import { describe, it, expect } from "vitest"
import {
  ChunkUploader,
  computeGrid,
  daysLeft,
  fitRect,
  formatBytes,
  formatElapsed,
  pickSupportedMimeType,
  pipRect,
} from "@/lib/recording-client"

const noSleep = async () => {}
const blob = (n = 3) => new Blob([new Uint8Array(n)])

function fakeFetch(plan: Array<number | "throw">) {
  const calls: { url: string }[] = []
  let i = 0
  const fn = (async (url: string) => {
    calls.push({ url })
    const step = plan[Math.min(i++, plan.length - 1)]
    if (step === "throw") throw new Error("network")
    return { ok: step >= 200 && step < 300, status: step } as Response
  }) as unknown as typeof fetch
  return { fn, calls }
}

describe("ChunkUploader", () => {
  it("uploads chunks in order with increasing indexes", async () => {
    const { fn, calls } = fakeFetch([200])
    const up = new ChunkUploader({ recordingId: "rec1", fetchFn: fn, sleep: noSleep })
    up.enqueue(blob()); up.enqueue(blob()); up.enqueue(blob())
    await up.flush()
    expect(calls.map((c) => c.url)).toEqual([
      "/api/recordings/rec1/chunks/0",
      "/api/recordings/rec1/chunks/1",
      "/api/recordings/rec1/chunks/2",
    ])
    expect(up.chunkCount).toBe(3)
    expect(up.uploadedBytes).toBe(9)
  })

  it("retries transient failures and keeps the index", async () => {
    const { fn, calls } = fakeFetch(["throw", 503, 200])
    const up = new ChunkUploader({ recordingId: "r", fetchFn: fn, sleep: noSleep })
    up.enqueue(blob())
    await up.flush()
    expect(calls).toHaveLength(3)
    expect(new Set(calls.map((c) => c.url)).size).toBe(1)
  })

  it("gives up after maxAttempts and rejects flush", async () => {
    const { fn, calls } = fakeFetch([500])
    const up = new ChunkUploader({ recordingId: "r", fetchFn: fn, sleep: noSleep, maxAttempts: 3 })
    up.enqueue(blob())
    await expect(up.flush()).rejects.toThrow()
    expect(calls).toHaveLength(3)
    expect(up.error).not.toBeNull()
  })

  it("does not retry permanent 4xx errors", async () => {
    const { fn, calls } = fakeFetch([403])
    const up = new ChunkUploader({ recordingId: "r", fetchFn: fn, sleep: noSleep })
    up.enqueue(blob())
    await expect(up.flush()).rejects.toThrow(/403/)
    expect(calls).toHaveLength(1)
  })

  it("retries 429", async () => {
    const { fn, calls } = fakeFetch([429, 200])
    const up = new ChunkUploader({ recordingId: "r", fetchFn: fn, sleep: noSleep })
    up.enqueue(blob())
    await up.flush()
    expect(calls).toHaveLength(2)
  })

  it("ignores empty blobs and stops accepting after a failure", async () => {
    const { fn, calls } = fakeFetch([400])
    const up = new ChunkUploader({ recordingId: "r", fetchFn: fn, sleep: noSleep })
    up.enqueue(new Blob([]))
    expect(up.chunkCount).toBe(0)
    up.enqueue(blob())
    await expect(up.flush()).rejects.toThrow()
    up.enqueue(blob())
    expect(calls).toHaveLength(1)
  })

  it("uses exponential backoff between attempts", async () => {
    const delays: number[] = []
    const { fn } = fakeFetch([500, 500, 200])
    const up = new ChunkUploader({ recordingId: "r", fetchFn: fn, baseDelayMs: 100, sleep: async (ms) => { delays.push(ms) } })
    up.enqueue(blob())
    await up.flush()
    expect(delays).toEqual([100, 200])
  })
})

describe("layout helpers", () => {
  it("fitRect letterboxes", () => {
    const r = fitRect(1000, 1000, { x: 0, y: 0, w: 1280, h: 720 })
    expect(r.h).toBe(720)
    expect(r.w).toBe(720)
    expect(r.x).toBe(280)
  })
  it("computeGrid returns one rect per tile inside the canvas", () => {
    for (const n of [1, 2, 3, 4, 5, 9]) {
      const rects = computeGrid(n, 1280, 720)
      expect(rects).toHaveLength(n)
      for (const r of rects) {
        expect(r.x).toBeGreaterThanOrEqual(0)
        expect(r.y).toBeGreaterThanOrEqual(0)
        expect(r.x + r.w).toBeLessThanOrEqual(1280.0001)
        expect(r.y + r.h).toBeLessThanOrEqual(720.0001)
      }
    }
    expect(computeGrid(0, 1280, 720)).toEqual([])
  })
  it("pipRect sits in the bottom-right corner", () => {
    const r = pipRect(1280, 720)
    expect(r.x + r.w).toBeLessThan(1280)
    expect(r.y + r.h).toBeLessThan(720)
    expect(r.x).toBeGreaterThan(640)
  })
})

describe("formatting & mime", () => {
  it("formatElapsed", () => {
    expect(formatElapsed(5)).toBe("00:05")
    expect(formatElapsed(65)).toBe("01:05")
    expect(formatElapsed(3725)).toBe("1:02:05")
    expect(formatElapsed(-4)).toBe("00:00")
  })
  it("formatBytes", () => {
    expect(formatBytes(512)).toBe("512 B")
    expect(formatBytes(2048)).toBe("2 KB")
    expect(formatBytes(5 * 1024 ** 2)).toBe("5.0 MB")
  })
  it("daysLeft rounds up and never goes negative", () => {
    const now = new Date("2026-10-01T00:00:00Z")
    expect(daysLeft("2026-10-31T00:00:00Z", now)).toBe(30)
    expect(daysLeft("2026-10-01T01:00:00Z", now)).toBe(1)
    expect(daysLeft("2026-09-01T00:00:00Z", now)).toBe(0)
  })
  it("pickSupportedMimeType prefers vp9 and falls back", () => {
    expect(pickSupportedMimeType(() => true)).toBe("video/webm;codecs=vp9,opus")
    expect(pickSupportedMimeType((t) => t === "video/mp4")).toBe("video/mp4")
    expect(pickSupportedMimeType(() => false)).toBe("")
  })
})
