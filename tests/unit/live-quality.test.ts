import { describe, it, expect } from "vitest"
import {
  BROADCAST_PRESETS, getPreset, simulcastLayersFor, viewerQualityOptions, VQ, formatBitrate, gradeUplink, DEFAULT_PRESET_ID,
} from "@/lib/live-quality"

describe("presets", () => {
  it("offers the Twitch-style ladder with sane bitrates (higher quality = higher bitrate)", () => {
    expect(BROADCAST_PRESETS.map((p) => p.id)).toEqual(["1080p60", "1080p30", "720p60", "720p30", "480p30", "360p30"])
    const p = (id: string) => getPreset(id)
    expect(p("1080p60").maxBitrate).toBeGreaterThan(p("1080p30").maxBitrate)
    expect(p("1080p30").maxBitrate).toBeGreaterThan(p("720p60").maxBitrate)
    expect(p("720p60").maxBitrate).toBeGreaterThan(p("720p30").maxBitrate)
    expect(p("720p30").maxBitrate).toBeGreaterThan(p("480p30").maxBitrate)
    expect(p("480p30").maxBitrate).toBeGreaterThan(p("360p30").maxBitrate)
    expect(p("1080p60").fps).toBe(60)
    expect(p("1080p60").width).toBe(1920)
  })
  it("unknown ids fall back to the default", () => {
    expect(getPreset("nope").id).toBe(DEFAULT_PRESET_ID)
    expect(getPreset(null).id).toBe(DEFAULT_PRESET_ID)
  })
})

describe("simulcast ladder", () => {
  it("1080p publishes 360p + 720p next to the source", () => {
    expect(simulcastLayersFor({ height: 1080 }).map((l) => l.height)).toEqual([360, 720])
  })
  it("720p publishes 360p, 480p publishes 240p, 360p publishes only the source", () => {
    expect(simulcastLayersFor({ height: 720 }).map((l) => l.height)).toEqual([360])
    expect(simulcastLayersFor({ height: 480 }).map((l) => l.height)).toEqual([240])
    expect(simulcastLayersFor({ height: 360 })).toEqual([])
  })
  it("lower layers are always cheaper than the layer above", () => {
    const layers = simulcastLayersFor({ height: 1080 })
    expect(layers[0].maxBitrate).toBeLessThan(layers[1].maxBitrate)
    expect(layers[1].maxBitrate).toBeLessThan(getPreset("1080p30").maxBitrate)
  })
})

describe("viewerQualityOptions", () => {
  it("1080p60 source → Otomatik, 1080p60, 720p, 360p, Yalnız ses", () => {
    const o = viewerQualityOptions(1080, 60)
    expect(o.map((x) => x.label)).toEqual(["Otomatik", "1080p60", "720p", "360p", "Yalnız ses"])
    expect(o.find((x) => x.id === "1080")!.quality).toBe(VQ.HIGH)
    expect(o.find((x) => x.id === "720")!.quality).toBe(VQ.MEDIUM)
    expect(o.find((x) => x.id === "360")!.quality).toBe(VQ.LOW)
    expect(o.find((x) => x.id === "audio")!.quality).toBeUndefined()
  })
  it("720p source has two layers → HIGH and LOW only", () => {
    const o = viewerQualityOptions(720, 30)
    expect(o.map((x) => x.label)).toEqual(["Otomatik", "720p", "360p", "Yalnız ses"])
    expect(o.find((x) => x.id === "720")!.quality).toBe(VQ.HIGH)
    expect(o.find((x) => x.id === "360")!.quality).toBe(VQ.LOW)
  })
  it("360p source offers just itself", () => {
    expect(viewerQualityOptions(360).map((x) => x.label)).toEqual(["Otomatik", "360p", "Yalnız ses"])
  })
})

describe("formatting & grading", () => {
  it("formatBitrate", () => {
    expect(formatBitrate(2_500_000)).toBe("2.5 Mb/sn")
    expect(formatBitrate(640_000)).toBe("640 Kb/sn")
    expect(formatBitrate(0)).toBe("—")
    expect(formatBitrate(NaN)).toBe("—")
  })
  it("gradeUplink", () => {
    expect(gradeUplink({ qualityLimitationReason: "none", roundTripTimeMs: 40, fps: 30, targetFps: 30 })).toBe("good")
    expect(gradeUplink({ qualityLimitationReason: "bandwidth" })).toBe("poor")
    expect(gradeUplink({ roundTripTimeMs: 600 })).toBe("poor")
    expect(gradeUplink({ qualityLimitationReason: "cpu" })).toBe("fair")
    expect(gradeUplink({ fps: 10, targetFps: 30 })).toBe("poor")
    expect(gradeUplink({ fps: 20, targetFps: 30 })).toBe("fair")
  })
})
