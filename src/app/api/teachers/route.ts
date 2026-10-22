import { db } from "@/lib/db"
import { notSuspended } from "@/lib/policy"
import { NextResponse } from "next/server"

// Must be dynamic: a statically cached list would hide newly approved teachers until the next build
export const dynamic = "force-dynamic"

// GET /api/teachers — Get all approved teachers (DB + static demo)
export async function GET() {
  try {
    const dbTeachers = await db.teacher.findMany({
      where: {
        isTrialMode: false,
        user: notSuspended(),
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
      const reviews = t.bookings.filter(b => b.review && b.review.status === "VISIBLE").map(b => b.review!)
      const avgRating = reviews.length > 0
        ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
        : 5.0

      return {
        id: t.id,
        slug: t.id,
        name: t.user.name || `${t.user.firstName || ""} ${t.user.lastName || ""}`.trim() || "Teacher",
        avatar: t.user.image || `https://i.pravatar.cc/400?u=${t.id}`,
        country: t.user.country || "Unknown",
        bio: t.bio || "Certified yoga teacher on AYA.",
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
