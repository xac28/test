/**
 * Browser-side helpers for lesson recording. Framework-free so they can be unit tested.
 */

// ── Chunk uploader ─────────────────────────────────────────────────────────

export interface ChunkUploaderOptions {
  recordingId: string
  fetchFn?: typeof fetch
  /** attempts per chunk before the upload is declared failed */
  maxAttempts?: number
  baseDelayMs?: number
  sleep?: (ms: number) => Promise<void>
}

/**
 * Uploads MediaRecorder chunks strictly in order, retrying each chunk with
 * exponential backoff. A chunk that exhausts its retries marks the uploader as
 * failed — the recording cannot be merged with a hole in it.
 */
export class ChunkUploader {
  private readonly recordingId: string
  private readonly fetchFn: typeof fetch
  private readonly maxAttempts: number
  private readonly baseDelayMs: number
  private readonly sleep: (ms: number) => Promise<void>
  private queue: { index: number; blob: Blob }[] = []
  private nextIndex = 0
  private running: Promise<void> | null = null
  private _error: Error | null = null
  private _uploadedBytes = 0

  constructor(opts: ChunkUploaderOptions) {
    this.recordingId = opts.recordingId
    this.fetchFn = opts.fetchFn ?? ((...args) => fetch(...args))
    this.maxAttempts = opts.maxAttempts ?? 5
    this.baseDelayMs = opts.baseDelayMs ?? 500
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
  }

  get chunkCount(): number {
    return this.nextIndex
  }
  get pending(): number {
    return this.queue.length
  }
  get error(): Error | null {
    return this._error
  }
  get uploadedBytes(): number {
    return this._uploadedBytes
  }

  enqueue(blob: Blob): void {
    if (blob.size === 0 || this._error) return
    this.queue.push({ index: this.nextIndex++, blob })
    if (!this.running) this.running = this.drain().finally(() => (this.running = null))
  }

  /** Resolves when everything queued so far is uploaded; rejects if any chunk failed for good. */
  async flush(): Promise<void> {
    while (this.running) await this.running
    if (this._error) throw this._error
  }

  private async drain(): Promise<void> {
    while (this.queue.length && !this._error) {
      const item = this.queue[0]
      try {
        await this.uploadWithRetry(item.index, item.blob)
        this._uploadedBytes += item.blob.size
        this.queue.shift()
      } catch (e: any) {
        this._error = e instanceof Error ? e : new Error(String(e))
        this.queue = []
      }
    }
  }

  private async uploadWithRetry(index: number, blob: Blob): Promise<void> {
    let lastError: Error | null = null
    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      try {
        const res = await this.fetchFn(`/api/recordings/${this.recordingId}/chunks/${index}`, {
          method: "PUT",
          headers: { "Content-Type": "application/octet-stream" },
          body: blob,
        })
        if (res.ok) return
        // 4xx (except 429) will not get better by retrying
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw new PermanentUploadError(`Parça ${index} reddedildi (HTTP ${res.status})`)
        }
        lastError = new Error(`Parça ${index} yüklenemedi (HTTP ${res.status})`)
      } catch (e: any) {
        if (e instanceof PermanentUploadError) throw e
        lastError = e instanceof Error ? e : new Error(String(e))
      }
      await this.sleep(this.baseDelayMs * 2 ** attempt)
    }
    throw lastError ?? new Error(`Parça ${index} yüklenemedi`)
  }
}

class PermanentUploadError extends Error {}

// ── Canvas layout ──────────────────────────────────────────────────────────

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Fit a source of srcW×srcH inside `box`, preserving aspect ratio (letterbox). */
export function fitRect(srcW: number, srcH: number, box: Rect): Rect {
  if (srcW <= 0 || srcH <= 0) return box
  const scale = Math.min(box.w / srcW, box.h / srcH)
  const w = srcW * scale
  const h = srcH * scale
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h }
}

/**
 * Tile rectangles for `count` participants on a W×H canvas.
 * 1 → full frame, 2 → side by side, 3–4 → 2×2, more → near-square grid.
 */
export function computeGrid(count: number, width: number, height: number, gap = 8): Rect[] {
  if (count <= 0) return []
  if (count === 1) return [{ x: 0, y: 0, w: width, h: height }]
  const cols = count === 2 ? 2 : Math.ceil(Math.sqrt(count))
  const rows = Math.ceil(count / cols)
  const cellW = (width - gap * (cols + 1)) / cols
  const cellH = (height - gap * (rows + 1)) / rows
  return Array.from({ length: count }, (_, i) => ({
    x: gap + (i % cols) * (cellW + gap),
    y: gap + Math.floor(i / cols) * (cellH + gap),
    w: cellW,
    h: cellH,
  }))
}

/** Picture-in-picture rectangle (bottom-right) used for a 1:1 lesson's self view. */
export function pipRect(width: number, height: number, margin = 24): Rect {
  const w = Math.round(width * 0.22)
  const h = Math.round((w * 9) / 16)
  return { x: width - w - margin, y: height - h - margin, w, h }
}

// ── Mime type & misc ───────────────────────────────────────────────────────

/** Best supported MediaRecorder container; WebM/VP9 first, MP4 as the Safari fallback. */
export function pickSupportedMimeType(isSupported: (t: string) => boolean): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ]
  return candidates.find((t) => isSupported(t)) ?? ""
}

export function formatElapsed(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, "0")
  const ss = String(sec).padStart(2, "0")
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

export function daysLeft(expiresAt: string | Date, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 86_400_000))
}
