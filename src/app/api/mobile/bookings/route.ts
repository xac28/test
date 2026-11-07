import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { termsGate } from "@/lib/terms"
import { resolveUser } from "@/lib/auth-utils"

// GET /api/mobile/bookings
export async function GET(req: Request) {
  try {
    const user = await resolveUser(req)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const termsBlock = termsGate(user)
    if (termsBlock) return termsBlock

    let bookings

    if (user.role === "TEACHER") {
      const teacher = await db.teacher.findUnique({ where: { userId: user.id } })
      if (!teacher) {
        return NextResponse.json({ bookings: [] })
      }

      bookings = await db.booking.findMany({
        where: { teacherId: teacher.id },
        include: { student: true },
        orderBy: { startTime: "asc" },
        take: 20,
      })
    } else {
      bookings = await db.booking.findMany({
        where: { studentId: user.id },
        include: { teacher: { include: { user: true } } },
        orderBy: { startTime: "asc" },
        take: 20,
      })
    }

    return NextResponse.json({ bookings })
  } catch (error: any) {
    console.error("[MOBILE_BOOKINGS_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

// POST /api/mobile/bookings — Create a new booking from mobile
export async function POST(req: Request) {
  try {
    const user = await resolveUser(req)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const termsBlock = termsGate(user)
    if (termsBlock) return termsBlock

    const { teacherId, slot, type } = await req.json()

    if (!teacherId || !slot || !type) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 })
    }

    const teacher = await db.teacher.findUnique({
      where: { id: teacherId },
      include: { user: true }
    })

    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 })
    }

    // Server-side price calculation
    if (teacher.isTrialMode) {
      return NextResponse.json({ error: "Bu öğretmen henüz onaylanmadı.", code: "TEACHER_NOT_APPROVED" }, { status: 403 })
    }

    let price = type === "trial" ? Math.round(teacher.hourlyRate * 0.5 * 100) / 100 : teacher.hourlyRate
    if (price < 0) price = 0

    const startTime = new Date(slot)
    if (isNaN(startTime.getTime())) {
      return NextResponse.json({ error: "Invalid slot date" }, { status: 400 })
    }
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000)

    const booking = await db.booking.create({
      data: {
        studentId: user.id,
        teacherId: teacher.id,
        startTime,
        endTime,
        status: "PENDING",
        price,
        dailyRoomName: `mob-room-${Date.now()}`,
        dailyRoomUrl: process.env.LIVEKIT_URL || "ws://localhost:7880",
      }
    })

    return NextResponse.json({
      success: true,
      bookingId: booking.id,
      price,
      message: "Booking initiated. Complete payment via web or Stripe mobile SDK."
    })
  } catch (error: any) {
    console.error("[MOBILE_BOOKING_CREATE_ERROR]", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
