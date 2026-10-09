import { describe, it, expect } from "vitest"
import {
  sanitizeChatText, encodeChat, decodeChat, canSendNow, appendMessage, nameColor, parseRoomSettings,
  serializeRoomSettings, formatDuration, MAX_CHAT_LEN, MAX_MESSAGES_KEPT, ChatMessage,
} from "@/lib/live-chat"

const sender = { identity: "u1", name: "Ayşe", isHost: false }
const packet = (o: object) => new TextEncoder().encode(JSON.stringify(o))

describe("sanitizeChatText", () => {
  it("trims, collapses whitespace and strips control / bidi characters", () => {
    expect(sanitizeChatText("  merhaba \n\n  dünya\t! ")).toBe("merhaba dünya !")
    expect(sanitizeChatText("a‮b\u0000c")).toBe("a b c")
  })
  it("caps length and rejects non-strings", () => {
    expect(sanitizeChatText("x".repeat(1000))).toHaveLength(MAX_CHAT_LEN)
    expect(sanitizeChatText(42)).toBe("")
    expect(sanitizeChatText(null)).toBe("")
    expect(sanitizeChatText("   ")).toBe("")
  })
  it("keeps HTML as inert text (React escapes it) rather than interpreting it", () => {
    expect(sanitizeChatText("<img src=x onerror=alert(1)>")).toBe("<img src=x onerror=alert(1)>")
  })
})

describe("encode/decode", () => {
  it("round-trips and takes identity from the sender, never the payload", () => {
    const bytes = encodeChat({ id: "m1", text: "selam", ts: 1000 })
    const msg = decodeChat(bytes, sender)!
    expect(msg).toMatchObject({ id: "m1", text: "selam", ts: 1000, identity: "u1", name: "Ayşe", isHost: false })
    const spoof = decodeChat(packet({ t: "chat", id: "x", text: "hi", identity: "host", isHost: true, name: "Eğitmen" }), sender)!
    expect(spoof.identity).toBe("u1")
    expect(spoof.isHost).toBe(false)
    expect(spoof.name).toBe("Ayşe")
  })
  it("drops malformed, empty, wrong-type and oversized packets", () => {
    expect(decodeChat(new TextEncoder().encode("not json"), sender)).toBeNull()
    expect(decodeChat(packet({ t: "other", text: "x" }), sender)).toBeNull()
    expect(decodeChat(packet({ t: "chat", text: "   " }), sender)).toBeNull()
    expect(decodeChat(new Uint8Array(5000), sender)).toBeNull()
  })
})

describe("slow mode", () => {
  it("lets the host through and blocks viewers until the wait is over", () => {
    expect(canSendNow(0, 1000, 10, true)).toEqual({ ok: true, waitSec: 0 })
    expect(canSendNow(0, 1000, 0, false).ok).toBe(true)
    expect(canSendNow(1000, 4000, 10, false)).toEqual({ ok: false, waitSec: 7 })
    expect(canSendNow(1000, 11000, 10, false).ok).toBe(true)
  })
})

describe("message list", () => {
  const mk = (i: number, identity = "u"): ChatMessage => ({ id: `m${i}`, identity, name: "n", text: "t", ts: i, isHost: false })
  it("dedupes by id+identity and keeps only the newest 200", () => {
    let list: ChatMessage[] = []
    list = appendMessage(list, mk(1))
    list = appendMessage(list, mk(1))
    expect(list).toHaveLength(1)
    list = appendMessage(list, mk(1, "other")) // same id, other sender → different message
    expect(list).toHaveLength(2)
    for (let i = 2; i < MAX_MESSAGES_KEPT + 50; i++) list = appendMessage(list, mk(i))
    expect(list).toHaveLength(MAX_MESSAGES_KEPT)
    expect(list[list.length - 1].id).toBe(`m${MAX_MESSAGES_KEPT + 49}`)
  })
})

describe("nameColor & settings & duration", () => {
  it("nameColor is stable and a hex colour", () => {
    expect(nameColor("abc")).toBe(nameColor("abc"))
    expect(nameColor("abc")).toMatch(/^#[0-9A-F]{6}$/i)
  })
  it("room settings parse defensively and round-trip", () => {
    expect(parseRoomSettings(undefined)).toEqual({ chatEnabled: true, slowModeSec: 0 })
    expect(parseRoomSettings("garbage")).toEqual({ chatEnabled: true, slowModeSec: 0 })
    expect(parseRoomSettings(JSON.stringify({ chatEnabled: false, slowModeSec: 7 }))).toMatchObject({ chatEnabled: false, slowModeSec: 0 }) // 7 is not an allowed choice
    const s = { chatEnabled: false, slowModeSec: 10, title: "Sabah Yogası" }
    expect(parseRoomSettings(serializeRoomSettings(s))).toEqual(s)
  })
  it("formatDuration", () => {
    expect(formatDuration(0)).toBe("00:00")
    expect(formatDuration(3725)).toBe("1:02:05")
  })
})
