import { NextResponse } from "next/server"
import { invalidateMobileSession, invalidateAllMobileSessions, resolveUser } from "@/lib/auth-utils"

/**
 * POST /api/mobile/auth/logout
 * 
 * Instagram-style logout options:
 * - Default: invalidates only the current session token
 * - ?all=true: invalidates ALL sessions (log out everywhere)
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      // No token = already logged out
      return NextResponse.json({ success: true })
    }

    const token = authHeader.slice(7).trim()
    const { searchParams } = new URL(req.url)
    const logoutAll = searchParams.get("all") === "true"

    if (logoutAll) {
      // "Log out of all devices" — resolve user first, then nuke all sessions
      const user = await resolveUser(req)
      if (user) {
        const count = await invalidateAllMobileSessions(user.id)
        return NextResponse.json({ success: true, sessionsRevoked: count })
      }
    }

    // Default: invalidate only this token
    await invalidateMobileSession(token)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[MOBILE_LOGOUT_ERROR]", error)
    return NextResponse.json(
      { error: "Çıkış yapılamadı." },
      { status: 500 }
    )
  }
}
