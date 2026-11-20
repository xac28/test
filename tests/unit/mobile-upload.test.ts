import { describe, it, expect } from "vitest"
// The mobile helper is plain TS with no react-native imports at module level besides constants
import { describeAsset } from "../../namaste-mobile/lib/upload"

describe("mobile describeAsset", () => {
  it("keeps a proper jpeg", () => {
    expect(describeAsset({ uri: "file:///a/b/photo.jpg", mimeType: "image/jpeg" }, "avatar")).toEqual({ name: "photo.jpg", type: "image/jpeg" })
  })
  it("maps image/jpg, and a bare 'image' mimeType via the extension", () => {
    expect(describeAsset({ uri: "file:///x/p.jpg", mimeType: "image/jpg" }, "avatar").type).toBe("image/jpeg")
    expect(describeAsset({ uri: "file:///x/p.PNG", mimeType: "image" }, "avatar")).toEqual({ name: "p.png", type: "image/png" })
  })
  it("iPhone video: .MOV without a mime type becomes video/quicktime", () => {
    expect(describeAsset({ uri: "file:///x/IMG_0042.MOV", fileName: "IMG_0042.MOV" }, "video")).toEqual({ name: "IMG_0042.mov", type: "video/quicktime" })
  })
  it("fixes a wrong extension to match the type, and invents names when missing", () => {
    expect(describeAsset({ uri: "file:///x/clip.mp4", mimeType: "video/quicktime" }, "video")).toEqual({ name: "clip.mov", type: "video/quicktime" })
    const d = describeAsset({ uri: "content://media/external/12345" }, "video")
    expect(d.type).toBe("video/mp4")
    expect(d.name).toMatch(/^12345\.mp4$|^video-\d+\.mp4$/)
  })
  it("falls back sensibly with no information", () => {
    expect(describeAsset({ uri: "file:///x/y" }, "avatar").type).toBe("image/jpeg")
    expect(describeAsset({ uri: "file:///x/y" }, "video").type).toBe("video/mp4")
  })
})
