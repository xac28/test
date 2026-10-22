/** Live chat: message format, validation, slow mode, room settings. Pure & unit-tested. */

export const MAX_CHAT_LEN = 300
export const MAX_MESSAGES_KEPT = 200

export interface ChatMessage {
  id: string
  identity: string
  name: string
  text: string
  ts: number
  isHost: boolean
}

export interface RoomSettings {
  chatEnabled: boolean
  /** seconds a viewer must wait between messages (0 = off) */
  slowModeSec: number
  title?: string
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = { chatEnabled: true, slowModeSec: 0 }

const SLOW_MODE_CHOICES = [0, 3, 5, 10, 30, 60]
export const SLOW_MODE_OPTIONS = SLOW_MODE_CHOICES

export function sanitizeChatText(raw: unknown): string {
  if (typeof raw !== "string") return ""
  return raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CHAT_LEN)
}

export function encodeChat(msg: Pick<ChatMessage, "id" | "text" | "ts">): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({ t: "chat", id: msg.id, text: msg.text, ts: msg.ts }))
}

/**
 * Decode a received data packet. The sender's identity/name come from LiveKit (server
 * stamped), never from the payload, so a viewer cannot impersonate the host.
 */
export function decodeChat(
  payload: Uint8Array,
  sender: { identity: string; name?: string; isHost: boolean }
): ChatMessage | null {
  try {
    if (payload.byteLength > 2048) return null
    const data = JSON.parse(new TextDecoder().decode(payload))
    if (data?.t !== "chat") return null
    const text = sanitizeChatText(data.text)
    if (!text) return null
    const id = typeof data.id === "string" && data.id.length <= 64 ? data.id : `${sender.identity}-${Date.now()}`
    const ts = Number.isFinite(data.ts) ? Number(data.ts) : Date.now()
    return { id, identity: sender.identity, name: (sender.name || "Katılımcı").slice(0, 40), text, ts, isHost: sender.isHost }
  } catch {
    return null
  }
}

export function canSendNow(
  lastSentAt: number,
  now: number,
  slowModeSec: number,
  isHost: boolean
): { ok: boolean; waitSec: number } {
  if (isHost || slowModeSec <= 0) return { ok: true, waitSec: 0 }
  const wait = Math.ceil((lastSentAt + slowModeSec * 1000 - now) / 1000)
  return wait > 0 ? { ok: false, waitSec: wait } : { ok: true, waitSec: 0 }
}

export function appendMessage(list: ChatMessage[], msg: ChatMessage): ChatMessage[] {
  if (list.some((m) => m.id === msg.id && m.identity === msg.identity)) return list
  const next = [...list, msg]
  return next.length > MAX_MESSAGES_KEPT ? next.slice(next.length - MAX_MESSAGES_KEPT) : next
}

const NAME_COLORS = [
  "#FF7A59", "#F4B942", "#7BD389", "#4FC3F7", "#B39DDB", "#F48FB1",
  "#80CBC4", "#FFB74D", "#A5D6A7", "#90CAF9", "#CE93D8", "#E6EE9C",
]

/** Stable colour per user, like Twitch usernames. */
export function nameColor(identity: string): string {
  let h = 0
  for (let i = 0; i < identity.length; i++) h = (h * 31 + identity.charCodeAt(i)) >>> 0
  return NAME_COLORS[h % NAME_COLORS.length]
}

export function parseRoomSettings(metadata: string | undefined | null): RoomSettings {
  if (!metadata) return { ...DEFAULT_ROOM_SETTINGS }
  try {
    const d = JSON.parse(metadata)
    const slow = Number(d.slowModeSec)
    return {
      chatEnabled: d.chatEnabled !== false,
      slowModeSec: SLOW_MODE_CHOICES.includes(slow) ? slow : 0,
      title: typeof d.title === "string" ? d.title.slice(0, 120) : undefined,
    }
  } catch {
    return { ...DEFAULT_ROOM_SETTINGS }
  }
}

export function serializeRoomSettings(s: RoomSettings): string {
  return JSON.stringify({ chatEnabled: s.chatEnabled, slowModeSec: s.slowModeSec, ...(s.title ? { title: s.title } : {}) })
}

export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, "0")
  const ss = String(sec).padStart(2, "0")
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
