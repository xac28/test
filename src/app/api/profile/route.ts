import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"

export const dynamic = "force-dynamic"

// ── FIX #12: Hassas alanlar (email, role, password, banned) profile update ile değiştirilemez ──
// Güncellenmesine izin verilen alanların whitelist'i
const ALLOWED_PROFILE_FIELDS = new Set([
  "firstName", "lastName", "dateOfBirth", "phone",
  "address", "country", "passportId", "interests"
])

// PUT /api/profile — Update user profile
export async function PUT(req: Request) {
  try {
    const user = await resolveUser(req)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()

    // Hassas alan koruması — bu alanlar bu endpoint üzerinden değiştirilemez
    const PROTECTED_FIELDS = ["email", "role", "password", "banned", "banReason", 
                              "bannedAt", "id", "points", "badges", "currentStreak", 
                              "longestStreak", "subscriptionPlan", "subscriptionEnds",
                              "stripeCustomerId", "emailVerified"]
    
    for (const field of PROTECTED_FIELDS) {
      if (field in body) {
        return NextResponse.json(
          { error: `Cannot modify protected field: ${field}` }, 
          { status: 403 }
        )
      }
    }

    const { firstName, lastName, dateOfBirth, phone, address, country, passportId, interests } = body

    if (!firstName || !lastName) {
      return NextResponse.json({ error: "First name and last name are required" }, { status: 400 })
    }

    // Input sanitization
    if (firstName.length > 50 || lastName.length > 50) {
      return NextResponse.json({ error: "Name fields are too long (max 50 chars)" }, { status: 400 })
    }

    if (phone && !/^\+?[\d\s\-()]{7,20}$/.test(phone)) {
      return NextResponse.json({ error: "Invalid phone number format" }, { status: 400 })
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        phone: phone || null,
        address: address || null,
        country: country || null,
        passportId: passportId || null,
        interests: interests?.length ? JSON.stringify(interests) : null,
        profileCompleted: true,
      }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[PROFILE_UPDATE_ERROR]", error)
    return NextResponse.json({ error: error.message || "Internal Error" }, { status: 500 })
  }
}

// GET /api/profile — Get current user profile
export async function GET(req: Request) {
  try {
    const user = await resolveUser(req)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const profile = await db.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        phone: true,
        address: true,
        country: true,
        passportId: true,
        interests: true,
        profileCompleted: true,
        points: true,
        currentStreak: true,
        longestStreak: true,
        subscriptionPlan: true,
        subscriptionEnds: true,
        createdAt: true,
      }
    })

    return NextResponse.json(profile)
  } catch (error: any) {
    console.error("[PROFILE_GET_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}
