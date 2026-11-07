"use strict"

// Pure helpers of the desktop app (no Electron here, so they can be unit-tested).

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

/** "k7qm 4txd" / "K7QM-4TXD" / "K7QM4TXD" → "K7QM-4TXD", or null when it cannot be a pairing code. */
function normalizeCode(raw) {
  if (typeof raw !== "string") return null
  const c = raw.toUpperCase().replace(/[^A-Z0-9]/g, "")
  if (c.length !== 8 || [...c].some((ch) => !ALPHABET.includes(ch))) return null
  return `${c.slice(0, 4)}-${c.slice(4)}`
}

/** The server address must be https (plain http only for this computer, for development). Returns the origin or null. */
function normalizeServerUrl(raw) {
  if (typeof raw !== "string") return null
  let u
  try {
    u = new URL(raw.trim())
  } catch {
    return null
  }
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1"
  if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) return null
  if (u.username || u.password) return null
  return u.origin
}

/** Same origin as the server: the only place the studio window may navigate to. */
function isSameOrigin(url, origin) {
  try {
    return new URL(url).origin === origin
  } catch {
    return false
  }
}

/** Opening links outside the app: https only. */
function isSafeExternal(url) {
  try {
    return new URL(url).protocol === "https:"
  } catch {
    return false
  }
}

/** true when version a is older than b ("1.2.0" < "1.10.0"). */
function olderThan(a, b) {
  const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0)
  const pb = String(b).split(".").map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0)
  return false
}

/** Permissions the studio window may use, for its own origin only. */
const ALLOWED_PERMISSIONS = new Set(["media", "mediaKeySystem", "display-capture", "fullscreen", "clipboard-sanitized-write"])

module.exports = { normalizeCode, normalizeServerUrl, isSameOrigin, isSafeExternal, olderThan, ALLOWED_PERMISSIONS }
