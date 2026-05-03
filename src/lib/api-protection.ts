import { NextResponse } from "next/server"
import { rateLimit, RATE_LIMIT_API } from "./rate-limit"
import type { RateLimitConfig } from "./rate-limit"

/**
 * Extract client IP from request headers (works behind proxies/load balancers)
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }
  const realIp = req.headers.get("x-real-ip")
  if (realIp) return realIp
  return "unknown"
}

/**
 * Apply rate limiting to an API route handler.
 * Returns a 429 response if the limit is exceeded, otherwise null (proceed).
 */
export function applyRateLimit(
  req: Request,
  config: RateLimitConfig = RATE_LIMIT_API
): NextResponse | null {
  const ip = getClientIp(req)
  const result = rateLimit(ip, config)

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: "Too many requests. Please slow down.",
        retryAfterMs: result.retryAfterMs,
      },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil(result.retryAfterMs / 1000).toString(),
          "X-RateLimit-Remaining": "0",
        },
      }
    )
  }

  return null // Allowed — continue
}

/**
 * Wraps an API handler with error boundary + rate limiting.
 * Prevents unhandled exceptions from crashing the process.
 */
export function withProtection(
  handler: (req: Request, context?: any) => Promise<NextResponse>,
  config?: RateLimitConfig
) {
  return async (req: Request, context?: any): Promise<NextResponse> => {
    // 1. Rate limit check
    const rateLimitResponse = applyRateLimit(req, config)
    if (rateLimitResponse) return rateLimitResponse

    // 2. Execute handler inside error boundary
    try {
      return await handler(req, context)
    } catch (error: any) {
      console.error(`[API_CRASH_PREVENTED] ${req.url}`, error?.message || error)
      
      // Never expose internal errors to the client
      return NextResponse.json(
        { error: "Internal server error. Our team has been notified." },
        { status: 500 }
      )
    }
  }
}
