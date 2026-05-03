import { headers } from "next/headers"
import { NextResponse } from "next/server"
import Stripe from "stripe"
import { db } from "@/lib/db"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
})

// ── FIX #7: Idempotency koruması — aynı event birden fazla işlenmez ──
export async function POST(req: Request) {
  const body = await req.text()
  const sig = headers().get("Stripe-Signature") as string

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session

    const bookingId = session.client_reference_id || session.metadata?.bookingId
    if (!bookingId) {
      return NextResponse.json({ error: "No booking ID in session" }, { status: 400 })
    }

    try {
      // Idempotency check: booking zaten CONFIRMED veya COMPLETED ise tekrar işleme
      const existingBooking = await db.booking.findUnique({
        where: { id: bookingId }
      })

      if (!existingBooking) {
        return NextResponse.json({ error: "Booking not found" }, { status: 404 })
      }

      if (existingBooking.status === "CONFIRMED" || existingBooking.status === "COMPLETED") {
        // Zaten işlenmiş — Stripe retry'ı, idempotent olarak başarılı dön
        console.log(`[WEBHOOK] Booking ${bookingId} already ${existingBooking.status}, skipping duplicate`)
        return NextResponse.json({ success: true, message: "Already processed (idempotent)" })
      }

      // Stripe Payment Intent ID ile de idempotency kontrolü
      if (session.payment_intent) {
        const paymentIntentId = typeof session.payment_intent === "string" 
          ? session.payment_intent 
          : session.payment_intent.id

        const duplicateByPayment = await db.booking.findUnique({
          where: { stripePaymentIntentId: paymentIntentId }
        })

        if (duplicateByPayment && duplicateByPayment.id !== bookingId) {
          console.log(`[WEBHOOK] Payment intent ${paymentIntentId} already used for booking ${duplicateByPayment.id}`)
          return NextResponse.json({ success: true, message: "Payment already processed" })
        }
      }

      // Just use the bookingId as the roomName for LiveKit to keep it simple and robust
      const roomName = `room-${bookingId}`

      // Update booking status with payment intent ID for idempotency
      const booking = await db.booking.update({
        where: { id: bookingId },
        data: {
          status: "CONFIRMED",
          dailyRoomName: roomName,
          dailyRoomUrl: process.env.LIVEKIT_URL || "ws://localhost:7880",
          stripePaymentIntentId: session.payment_intent 
            ? (typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id) 
            : null,
        },
        include: {
          student: true,
          teacher: { include: { user: true } },
        }
      })

      // Send Email to Student
      try {
        const { sendBookingConfirmationEmail } = require("@/lib/email")
        if (booking.student.email) {
          await sendBookingConfirmationEmail(
            booking.student.email,
            booking.student.name || "Student",
            booking.teacher.user.name || "Teacher",
            booking.startTime,
            `${process.env.NEXTAUTH_URL}/dashboard` // Link to their dashboard
          )
        }
      } catch (emailErr) {
        console.error("Failed to send booking email:", emailErr)
      }

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("[WEBHOOK_ERROR]", error)
      return NextResponse.json({ error: "Database update failed" }, { status: 500 })
    }
  }

  return NextResponse.json({ received: true })
}
