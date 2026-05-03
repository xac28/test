/**
 * In-Memory Rate Limiter (Enterprise-Grade)
 * 
 * Sliding-window rate limiter that works per-IP.
 * Prevents API abuse, brute-force attacks, and DDoS-style traffic spikes.
 * 
 * For multi-instance deployments (e.g. behind a load balancer), 
 * swap this for Redis-based rate limiting.
 */

interface RateLimitEntry {
  timestamps: number[]
}

const rateLimitMap = new Map<string, RateLimitEntry>()

// Auto-cleanup stale entries every 60 seconds to prevent memory leak
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap) {
    // Remove entries with no recent requests (older than 5 minutes)
    if (entry.timestamps.length === 0 || entry.timestamps[entry.timestamps.length - 1] < now - 300_000) {
      rateLimitMap.delete(key)
    }
  }
}, 60_000)

export interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  maxRequests: number
  /** Time window in milliseconds */
  windowMs: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

/**
 * Check if a request from a given identifier should be allowed.
 * Uses a sliding window algorithm for accuracy.
 */
export function rateLimit(
  identifier: string,
  config: RateLimitConfig = { maxRequests: 30, windowMs: 60_000 }
): RateLimitResult {
  const now = Date.now()
  const { maxRequests, windowMs } = config

  let entry = rateLimitMap.get(identifier)
  if (!entry) {
    entry = { timestamps: [] }
    rateLimitMap.set(identifier, entry)
  }

  // Remove timestamps outside the current window
  entry.timestamps = entry.timestamps.filter(ts => ts > now - windowMs)

  if (entry.timestamps.length >= maxRequests) {
    // Rate limited — calculate when the earliest request expires
    const oldestInWindow = entry.timestamps[0]
    const retryAfterMs = (oldestInWindow + windowMs) - now

    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(retryAfterMs, 0),
    }
  }

  // Allow the request
  entry.timestamps.push(now)

  return {
    allowed: true,
    remaining: maxRequests - entry.timestamps.length,
    retryAfterMs: 0,
  }
}

// ─── Preset Configurations ─────────────────────────────────────────────────

/** General API: 60 requests per minute */
export const RATE_LIMIT_API: RateLimitConfig = { maxRequests: 60, windowMs: 60_000 }

/** Auth endpoints (login, register): 10 attempts per minute */
export const RATE_LIMIT_AUTH: RateLimitConfig = { maxRequests: 10, windowMs: 60_000 }

/** Write-heavy endpoints (post, comment, message): 20 per minute */
export const RATE_LIMIT_WRITE: RateLimitConfig = { maxRequests: 20, windowMs: 60_000 }

/** Admin actions: 30 per minute */
export const RATE_LIMIT_ADMIN: RateLimitConfig = { maxRequests: 30, windowMs: 60_000 }

/** AI endpoints (expensive): 5 per minute */
export const RATE_LIMIT_AI: RateLimitConfig = { maxRequests: 5, windowMs: 60_000 }

/** Upload endpoints: 5 per minute */
export const RATE_LIMIT_UPLOAD: RateLimitConfig = { maxRequests: 5, windowMs: 60_000 }
