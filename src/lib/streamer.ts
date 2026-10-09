import crypto from "crypto"
import path from "path"
import { promises as fs } from "fs"
import { encode } from "next-auth/jwt"
import { db } from "@/lib/db"

/** Desktop streaming app ("AYA Yayın Stüdyosu"): who may have it, how it signs in, and where the installer lives. */

export const PAIR_TTL_MS = 10 * 60_000 // a code is valid for ten minutes
export const DEVICE_TTL_MS = 30 * 24 * 3_600_000 // a paired app stays signed in for 30 days (unless revoked)
export const SESSION_TTL_S = 12 * 3600 // each cookie the app receives lives 12 hours
export const MAX_DEVICES = 5
export const MAX_OPEN_CODES = 3

/** Unambiguous letters and digits (no 0/O, 1/I/L): 8 characters ≈ 40 bits, shown as XXXX-XXXX. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
export function newPairCode(): string {
  const bytes = crypto.randomBytes(8)
  let out = ""
  for (let i = 0; i < 8; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return `${out.slice(0, 4)}-${out.slice(4)}`
}
/** accepts "k7qm 4txd", "K7QM4TXD" … and returns the canonical form, or null when it cannot be a code */
export function normalizePairCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const c = raw.toUpperCase().replace(/[^A-Z0-9]/g, "")
  if (c.length !== 8 || [...c].some((ch) => !ALPHABET.includes(ch))) return null
  return `${c.slice(0, 4)}-${c.slice(4)}`
}
export const hashSecret = (v: string) => crypto.createHash("sha256").update(v).digest("hex")
export const newDeviceToken = () => `ayas_${crypto.randomBytes(32).toString("hex")}`

export interface Eligibility { ok: boolean; reason?: "NOT_FOUND" | "BANNED" | "DELETED" | "ROLE" | "NO_PROFILE" | "SUSPENDED"; message?: string }
const MESSAGES: Record<NonNullable<Eligibility["reason"]>, string> = {
  NOT_FOUND: "Hesap bulunamadı.",
  BANNED: "Hesabın kapatılmış.",
  DELETED: "Hesap silinmiş.",
  ROLE: "Yayın uygulaması yalnızca eğitmenler içindir.",
  NO_PROFILE: "Eğitmen profilin henüz oluşturulmamış; önce başvurunu tamamla.",
  SUSPENDED: "Hesabın geçici olarak uzaklaştırılmış durumda; bu süre boyunca yayın uygulaması kullanılamaz.",
}

/**
 * The one rule for every step (download, pairing, token use): a teacher (approved or in the supervised trial phase) or an
 * admin, in good standing. What a trial teacher may broadcast is decided on the server when the room is opened.
 */
export async function streamerEligibility(userId: string): Promise<Eligibility> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, banned: true, deletedAt: true, suspendedUntil: true, teacher: { select: { isTrialMode: true } } },
  })
  const fail = (reason: NonNullable<Eligibility["reason"]>): Eligibility => ({ ok: false, reason, message: MESSAGES[reason] })
  if (!u) return fail("NOT_FOUND")
  if (u.deletedAt) return fail("DELETED")
  if (u.banned) return fail("BANNED")
  if (u.role !== "TEACHER" && u.role !== "ADMIN") return fail("ROLE")
  if (u.suspendedUntil && u.suspendedUntil > new Date()) return fail("SUSPENDED")
  if (u.role === "TEACHER" && !u.teacher) return fail("NO_PROFILE")
  return { ok: true }
}

/** Resolves the Bearer token of the desktop app to its device and owner, or null (unknown, revoked, expired, owner not eligible). */
export async function authenticateDevice(req: Request): Promise<{ device: { id: string; name: string; userId: string; expiresAt: Date }; userId: string } | { error: string; status: number }> {
  const h = req.headers.get("authorization") || ""
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : ""
  if (!token.startsWith("ayas_") || token.length > 100) return { error: "Geçersiz yayın uygulaması anahtarı.", status: 401 }
  const device = await db.streamerDevice.findUnique({ where: { tokenHash: hashSecret(token) } })
  if (!device || device.revokedAt || device.expiresAt <= new Date()) return { error: "Bu cihazın oturumu sona erdi. Uygulamada yeniden eşleştir.", status: 401 }
  const el = await streamerEligibility(device.userId)
  if (!el.ok) return { error: el.message!, status: 403 }
  return { device, userId: device.userId }
}

/** The web session cookie the app drops into its window, minted exactly like a normal sign-in (middleware and pages need no changes). */
export async function mintSessionCookie(userId: string) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, image: true, role: true, termsAcceptedAt: true, termsVersion: true } })
  if (!u) throw new Error("user missing")
  const secure = (process.env.NEXTAUTH_URL || "").startsWith("https://")
  const name = `${secure ? "__Secure-" : ""}authjs.session-token`
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET missing")
  const value = await encode({
    token: { sub: u.id, name: u.name, email: u.email, picture: u.image, role: u.role, rememberMe: false, loginAt: Date.now() },
    secret, salt: name, maxAge: SESSION_TTL_S,
  })
  return { name, value, secure, expiresAt: Date.now() + SESSION_TTL_S * 1000 }
}

// ── the installer ───────────────────────────────────────────────────────────
export const DOWNLOAD_DIR = path.join(process.env.STREAMER_DIR || path.join(process.cwd(), "storage", "downloads"))
export interface StreamerRelease { version: string; file: string; size: number; sha256: string; builtAt: string; minVersion?: string }

/** Reads storage/downloads/streamer.json (written by scripts/build-streamer.sh) and checks the file is really there. */
export async function currentRelease(): Promise<StreamerRelease | null> {
  try {
    const meta = JSON.parse(await fs.readFile(path.join(DOWNLOAD_DIR, "streamer.json"), "utf8"))
    const file = path.basename(String(meta.file || "")) // never a path
    const st = await fs.stat(path.join(DOWNLOAD_DIR, file))
    if (!st.isFile()) return null
    return { version: String(meta.version), file, size: st.size, sha256: String(meta.sha256 || ""), builtAt: String(meta.builtAt || ""), minVersion: meta.minVersion ? String(meta.minVersion) : undefined }
  } catch {
    return null
  }
}
