import { Room, Track, RemoteParticipant, LocalParticipant, Participant } from "livekit-client"
import {
  ChunkUploader,
  computeGrid,
  fitRect,
  pickSupportedMimeType,
  pipRect,
  Rect,
} from "@/lib/recording-client"

const CANVAS_W = 1280
const CANVAS_H = 720
const FPS = 30
const CHUNK_MS = 5000

export type RecordingTarget = { bookingId: string } | { liveRoomId: string }

export type RecorderState = "idle" | "starting" | "recording" | "stopping" | "error"

interface VideoTile {
  participant: Participant
  video: HTMLVideoElement
  isLocal: boolean
  isScreen: boolean
}

/**
 * Records everything that happens in the LiveKit room: it composites every video
 * track onto a canvas, mixes every audio track through WebAudio, feeds the result
 * to MediaRecorder and uploads 5-second chunks to the server as they arrive.
 *
 * Nothing is saved on the teacher's machine; the recording id is returned by the
 * server and the file becomes downloadable (teacher + student only) after `stop()`.
 *
 * Note: the draw loop uses a timer rather than requestAnimationFrame so recording
 * continues when the tab is in the background. The room's remote audio keeps the
 * tab "audible", which exempts it from aggressive timer throttling.
 */
export class RoomRecorder {
  private readonly room: Room
  private readonly onStateChange?: (s: RecorderState, detail?: string) => void

  private canvas: HTMLCanvasElement | null = null
  private ctx2d: CanvasRenderingContext2D | null = null
  private audioCtx: AudioContext | null = null
  private audioDest: MediaStreamAudioDestinationNode | null = null
  private audioSources = new Map<string, MediaStreamAudioSourceNode>()
  private tiles = new Map<string, VideoTile>()
  private recorder: MediaRecorder | null = null
  private uploader: ChunkUploader | null = null
  private drawTimer: ReturnType<typeof setInterval> | null = null
  private syncTimer: ReturnType<typeof setInterval> | null = null
  private startedAt = 0
  private _state: RecorderState = "idle"
  recordingId: string | null = null

  constructor(room: Room, onStateChange?: (s: RecorderState, detail?: string) => void) {
    this.room = room
    this.onStateChange = onStateChange
  }

  get state(): RecorderState {
    return this._state
  }

  get elapsedSec(): number {
    return this.startedAt ? (Date.now() - this.startedAt) / 1000 : 0
  }

  private setState(s: RecorderState, detail?: string) {
    this._state = s
    this.onStateChange?.(s, detail)
  }

  async start(target: RecordingTarget): Promise<void> {
    if (this._state === "starting" || this._state === "recording") return
    this.setState("starting")
    try {
      if (typeof MediaRecorder === "undefined") {
        throw new Error("Bu tarayıcı ders kaydını desteklemiyor")
      }
      const mimeType = pickSupportedMimeType((t) => MediaRecorder.isTypeSupported(t))

      const res = await fetch("/api/recordings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...target, mimeType }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Kayıt başlatılamadı")
      this.recordingId = data.id as string
      this.uploader = new ChunkUploader({ recordingId: this.recordingId! })

      this.canvas = document.createElement("canvas")
      this.canvas.width = CANVAS_W
      this.canvas.height = CANVAS_H
      this.ctx2d = this.canvas.getContext("2d")
      this.audioCtx = new AudioContext()
      this.audioDest = this.audioCtx.createMediaStreamDestination()
      this.syncTracks()

      const stream = new MediaStream([
        ...this.canvas.captureStream(FPS).getVideoTracks(),
        ...this.audioDest.stream.getAudioTracks(),
      ])
      this.recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 2_500_000,
        audioBitsPerSecond: 128_000,
      })
      this.recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this.uploader?.enqueue(e.data)
        if (this.uploader?.error) this.setState("error", this.uploader.error.message)
      }

      this.drawTimer = setInterval(() => this.draw(), 1000 / FPS)
      this.syncTimer = setInterval(() => this.syncTracks(), 2000)
      this.recorder.start(CHUNK_MS)
      this.startedAt = Date.now()
      window.addEventListener("beforeunload", this.warnBeforeUnload)
      this.setState("recording")
    } catch (e: any) {
      this.teardown()
      this.setState("error", e?.message || "Kayıt başlatılamadı")
      throw e
    }
  }

  async stop(): Promise<{ id: string } | null> {
    if (this._state !== "recording" && this._state !== "error") return null
    this.setState("stopping")
    const id = this.recordingId
    const durationSec = Math.round(this.elapsedSec)
    try {
      if (this.recorder && this.recorder.state !== "inactive") {
        await new Promise<void>((resolve) => {
          this.recorder!.onstop = () => resolve()
          this.recorder!.stop() // fires a final dataavailable before stop
        })
      }
      await this.uploader?.flush()
      if (!id) return null
      const res = await fetch(`/api/recordings/${id}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationSec, chunkCount: this.uploader?.chunkCount }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Kayıt tamamlanamadı")
      }
      this.teardown()
      this.setState("idle")
      return { id }
    } catch (e: any) {
      this.teardown()
      this.setState("error", e?.message || "Kayıt tamamlanamadı")
      throw e
    }
  }

  private warnBeforeUnload = (e: BeforeUnloadEvent) => {
    e.preventDefault()
    e.returnValue = ""
  }

  private teardown() {
    if (this.drawTimer) clearInterval(this.drawTimer)
    if (this.syncTimer) clearInterval(this.syncTimer)
    this.drawTimer = this.syncTimer = null
    window.removeEventListener("beforeunload", this.warnBeforeUnload)
    this.tiles.forEach((t) => {
      t.video.srcObject = null
    })
    this.tiles.clear()
    this.audioSources.forEach((s) => s.disconnect())
    this.audioSources.clear()
    this.audioCtx?.close().catch(() => {})
    this.audioCtx = null
    this.startedAt = 0
  }

  // ── Track bookkeeping ────────────────────────────────────────────────────

  private participants(): Participant[] {
    return [this.room.localParticipant as LocalParticipant, ...(Array.from(this.room.remoteParticipants.values()) as RemoteParticipant[])]
  }

  /** Keep one hidden <video> per video track and one WebAudio source per audio track. */
  private syncTracks() {
    const liveVideo = new Set<string>()
    const liveAudio = new Set<string>()

    for (const p of this.participants()) {
      const isLocal = p === this.room.localParticipant
      for (const pub of p.trackPublications.values()) {
        const track = pub.track
        if (!track || pub.isMuted) continue
        const mst = track.mediaStreamTrack
        if (!mst || mst.readyState !== "live") continue
        const key = `${p.identity}:${pub.trackSid}`

        if (track.kind === Track.Kind.Video) {
          liveVideo.add(key)
          if (!this.tiles.has(key)) {
            const video = document.createElement("video")
            video.muted = true
            video.playsInline = true
            video.srcObject = new MediaStream([mst])
            video.play().catch(() => {})
            this.tiles.set(key, {
              participant: p,
              video,
              isLocal,
              isScreen: pub.source === Track.Source.ScreenShare,
            })
          }
        } else if (track.kind === Track.Kind.Audio && this.audioCtx && this.audioDest) {
          liveAudio.add(key)
          if (!this.audioSources.has(key)) {
            const src = this.audioCtx.createMediaStreamSource(new MediaStream([mst]))
            src.connect(this.audioDest) // not to ctx.destination → no echo for the teacher
            this.audioSources.set(key, src)
          }
        }
      }
    }

    for (const [key, tile] of this.tiles) {
      if (!liveVideo.has(key)) {
        tile.video.srcObject = null
        this.tiles.delete(key)
      }
    }
    for (const [key, src] of this.audioSources) {
      if (!liveAudio.has(key)) {
        src.disconnect()
        this.audioSources.delete(key)
      }
    }
  }

  // ── Compositing ──────────────────────────────────────────────────────────

  private draw() {
    const ctx = this.ctx2d
    if (!ctx) return
    ctx.fillStyle = "#101410"
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    const tiles = Array.from(this.tiles.values()).filter((t) => t.video.videoWidth > 0)
    if (tiles.length === 0) return

    // A shared screen takes the stage; otherwise a 1:1 call is remote-big + self-pip.
    const screen = tiles.find((t) => t.isScreen)
    const remote = tiles.filter((t) => !t.isLocal && !t.isScreen)
    const local = tiles.find((t) => t.isLocal && !t.isScreen)

    if (screen) {
      this.paint(ctx, screen, { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H })
      const others = [...remote, ...(local ? [local] : [])].slice(0, 2)
      const pw = Math.round(CANVAS_W * 0.18)
      const ph = Math.round((pw * 9) / 16)
      others.forEach((t, i) => this.paint(ctx, t, { x: CANVAS_W - pw - 16, y: 16 + i * (ph + 12), w: pw, h: ph }))
      return
    }
    if (remote.length === 1 && local) {
      this.paint(ctx, remote[0], { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H })
      this.paint(ctx, local, pipRect(CANVAS_W, CANVAS_H))
      return
    }
    const all = [...remote, ...(local ? [local] : [])]
    computeGrid(all.length, CANVAS_W, CANVAS_H).forEach((rect, i) => this.paint(ctx, all[i], rect))
  }

  private paint(ctx: CanvasRenderingContext2D, tile: VideoTile, box: Rect) {
    const v = tile.video
    const r = fitRect(v.videoWidth, v.videoHeight, box)
    try {
      ctx.drawImage(v, r.x, r.y, r.w, r.h)
    } catch {
      /* video not ready this frame */
    }
  }
}
