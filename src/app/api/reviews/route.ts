import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { resolveUser } from "@/lib/auth-utils"
import { moderateText, strikeHint } from "@/lib/moderation"

// POST /api/reviews — Leave a review for a booking
// ── FIX #13: Aynı booking'e duplicate review engeli eklendi ──
export async function POST(req: Request) {
  try {
    const user = await resolveUser(req)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { bookingId, rating, comment } = await req.json()

    if (!bookingId || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Invalid rating" }, { status: 400 })
    }

    // Rating tam sayı olmalı
    if (!Number.isInteger(rating)) {
      return NextResponse.json({ error: "Rating must be an integer between 1-5" }, { status: 400 })
    }

    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: { review: true } // Review ilişkisini de getir
    })

    if (!booking || booking.studentId !== user.id) {
      return NextResponse.json({ error: "Booking not found or not yours" }, { status: 404 })
    }

    if (booking.status !== "COMPLETED") {
      return NextResponse.json({ error: "Cannot review incomplete booking" }, { status: 400 })
    }

    // Duplicate review kontrolü — bu booking için zaten review var mı?
    if (booking.review) {
      return NextResponse.json({ error: "You have already reviewed this booking" }, { status: 409 })
    }

    // The written part goes through the same automatic moderation as every other public text
    let sanitizedComment: string | null = null
    if (typeof comment === "string" && comment.trim()) {
      const checked = await moderateText(user, comment, "REVIEW", { max: 1000 })
      if (!checked.ok) return NextResponse.json({ error: checked.error, code: checked.code, hint: strikeHint(checked) }, { status: checked.status })
      sanitizedComment = checked.text
    }

    // Create the review
    const review = await db.review.create({
      data: {
        bookingId,
        rating,
        comment: sanitizedComment,
      }
    })

    return NextResponse.json({ success: true, review })
  } catch (error: any) {
    // Prisma unique constraint hatası — ek güvenlik katmanı
    if (error.code === "P2002") {
      return NextResponse.json({ error: "You have already reviewed this booking" }, { status: 409 })
    }
    console.error("[REVIEW_CREATE_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}
