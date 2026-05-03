import { db } from "@/lib/db"
import { NextResponse } from "next/server"

// GET /api/teachers — Get all approved teachers (DB + static demo)
export async function GET() {
  try {
    const dbTeachers = await db.teacher.findMany({
      where: {
        isTrialMode: false
      },
      include: {
        user: {
          select: {
            name: true,
            image: true,
            firstName: true,
            lastName: true,
            country: true,
          }
        },
        bookings: {
          where: { status: "COMPLETED" },
          include: { review: true },
        },
        availability: true,
      },
    })

    const teachers = dbTeachers.map(t => {
      const specialties = t.specialties ? JSON.parse(t.specialties) : []
      const completedSessions = t.bookings.length
      
      // Calculate real average rating from reviews
      const reviews = t.bookings.filter(b => b.review).map(b => b.review!)
      const avgRating = reviews.length > 0
        ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
        : 5.0

      return {
        id: t.id,
        slug: t.id,
        name: t.user.name || `${t.user.firstName || ""} ${t.user.lastName || ""}`.trim() || "Teacher",
        avatar: t.user.image || `https://i.pravatar.cc/400?u=${t.id}`,
        country: t.user.country || "Unknown",
        bio: t.bio || "Certified yoga teacher on Namaste.",
        specialties,
        hourlyRate: t.hourlyRate,
        studentsCount: completedSessions,
        rating: avgRating,
        reviewCount: reviews.length,
        isDbTeacher: true,
      }
    })

    return NextResponse.json(teachers)
  } catch (error: any) {
    console.error("[TEACHERS_API_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}
