/**
 * Enterprise Auth Utilities — Shared across Web & Mobile
 * 
 * Instagram-style unified identity system:
 * - One User record = one identity
 * - Web uses NextAuth JWT cookies
 * - Mobile uses Bearer tokens stored in Session table  
 * - Both can be active simultaneously (multiple sessions per user)
 * - Account linking: Google ↔ Credentials seamless
 * 
 * This module centralizes token validation, user resolution, and
 * session management so every API route uses the same logic.
 */

import { auth } from "@/auth"
import { db } from "@/lib/db"
import crypto from "crypto"
import { extractIp, logUserIp } from "@/lib/ban-engine"
import { hasAcceptedCurrentTerms } from "@/lib/terms"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  name: string | null
  email: string | null
  image: string | null
  role: string
  /** True when the user has accepted the current terms (sözleşme). */
  termsAccepted: boolean
}

export interface MobileSession {
  token: string
  expires: Date
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MOBILE_SESSION_DURATION_MS = 90 * 24 * 60 * 60 * 1000 // 90 days (like Instagram)
const TOKEN_ENTROPY_BYTES = 48 // 384-bit tokens for collision resistance

// ─── Core: Resolve User from Any Request ────────────────────────────────────

/**
 * Universal user resolver — works for both web and mobile.
 * 
 * Resolution order:
 * 1. Bearer token (mobile app) → validates against Session table
 * 2. NextAuth cookie (web browser) → validates JWT via NextAuth
 * 
 * This allows the same API endpoint to serve both platforms.
 */
export async function resolveUser(req: Request): Promise<AuthUser | null> {
  // 1. Try mobile bearer token first
  const mobileUser = await resolveFromBearerToken(req)
  if (mobileUser) {
    // 🛡️ Banned kontrolü
    const fullUser = await db.user.findUnique({
      where: { id: mobileUser.id },
      select: { banned: true }
    })
    if (fullUser?.banned) return null

    // IP logla (arka planda, bloklamaz)
    const ip = extractIp(req)
    const ua = req.headers.get("user-agent")
    logUserIp(mobileUser.id, ip, ua).catch(() => {})
    return mobileUser
  }

  // 2. Fall back to NextAuth web session
  const webUser = await resolveFromWebSession()
  if (webUser) {
    // 🛡️ Banned kontrolü
    const fullUser = await db.user.findUnique({
      where: { id: webUser.id },
      select: { banned: true }
    })
    if (fullUser?.banned) return null

    // IP logla
    const ip = extractIp(req)
    const ua = req.headers.get("user-agent")
    logUserIp(webUser.id, ip, ua).catch(() => {})
    return webUser
  }

  return null
}

/**
 * Resolve user from Bearer token (mobile sessions).
 * Validates token exists in DB, is not expired, and cleans up expired sessions.
 */
async function resolveFromBearerToken(req: Request): Promise<AuthUser | null> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) return null

  const token = authHeader.slice(7).trim()
  if (!token || token.length < 32) return null // Sanity check

  try {
    const session = await db.session.findUnique({
      where: { sessionToken: token },
      include: { user: true },
    })

    if (!session) return null

    // Check expiration
    if (session.expires < new Date()) {
      // Clean up expired session asynchronously
      db.session.delete({ where: { id: session.id } }).catch(() => {})
      return null
    }

    return sanitizeUser(session.user)
  } catch {
    return null
  }
}

/**
 * Resolve user from NextAuth web session (cookie-based JWT).
 */
async function resolveFromWebSession(): Promise<AuthUser | null> {
  try {
    const session = await auth()
    if (!session?.user?.id) return null

    const user = await db.user.findUnique({
      where: { id: session.user.id },
    })

    if (!user) return null
    return sanitizeUser(user)
  } catch {
    return null
  }
}

// ─── Mobile Session Management ──────────────────────────────────────────────

/**
 * Create a new mobile session token for a user.
 * Uses cryptographically secure random bytes (not hash of predictable data).
 */
export async function createMobileSession(userId: string): Promise<MobileSession> {
  // Generate a cryptographically secure random token
  const token = crypto.randomBytes(TOKEN_ENTROPY_BYTES).toString("hex")
  const expires = new Date(Date.now() + MOBILE_SESSION_DURATION_MS)

  await db.session.create({
    data: {
      sessionToken: token,
      userId,
      expires,
    },
  })

  return { token, expires }
}

/**
 * Invalidate a specific mobile session token.
 */
export async function invalidateMobileSession(token: string): Promise<boolean> {
  try {
    await db.session.deleteMany({
      where: { sessionToken: token },
    })
    return true
  } catch {
    return false
  }
}

/**
 * Invalidate ALL mobile sessions for a user (e.g., password change, security event).
 * This is the "Log out of all devices" feature like Instagram has.
 */
export async function invalidateAllMobileSessions(userId: string): Promise<number> {
  const result = await db.session.deleteMany({
    where: { userId },
  })
  return result.count
}

/**
 * Clean up expired sessions for a user (housekeeping).
 */
export async function cleanupExpiredSessions(userId: string): Promise<void> {
  await db.session.deleteMany({
    where: {
      userId,
      expires: { lt: new Date() },
    },
  })
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Sanitize user object for API responses — never leak password hashes.
 */
export function sanitizeUser(user: any): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
    termsAccepted: hasAcceptedCurrentTerms(user),
  }
}

/**
 * Normalize email for consistent lookup.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Validate email format.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Validate password strength.
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 6) {
    return { valid: false, error: "Şifre en az 6 karakter olmalıdır." }
  }
  if (password.length > 128) {
    return { valid: false, error: "Şifre çok uzun." }
  }
  return { valid: true }
}
