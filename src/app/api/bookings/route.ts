import { db } from "@/lib/db"
import { NextResponse } from "next/server"
import { termsGate } from "@/lib/terms"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_WRITE } from "@/lib/rate-limit"
import { resolveUser } from "@/lib/auth-utils"

// POST /api/bookings — Create a new booking (after checkout)
export async function POST(req: Request) {
  const blocked = applyRateLimit(req, RATE_LIMIT_WRITE)
  if (blocked) return blocked

  try {
    const user = await resolveUser(req)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const termsBlock = termsGate(user)
    if (termsBlock) return termsBlock

    const { teacherSlug, slot, type, paymentProvider } = await req.json()

    if (!teacherSlug || !slot || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // ── FIX #3: Sadece slug ile eşleşen öğretmen kullan, fallback yok ──
    const teachers = await db.teacher.findMany({
      include: { user: true }
    })

    const slugNormalized = teacherSlug.toLowerCase().replace(/-/g, " ")
    const teacher = teachers.find(t => 
      t.user.name?.toLowerCase().replace(/-/g, " ") === slugNormalized
    )

    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found for the given slug" }, { status: 404 })
    }

    // ── FIX #2: Price sunucu tarafında hesaplanıyor, client'tan gelen price kabul edilmiyor ──
    let serverPrice: number
    if (type === "trial") {
      // Trial derslerin fiyatı sabit veya hourlyRate'in yarısı
      serverPrice = Math.round(teacher.hourlyRate * 0.5 * 100) / 100
      if (serverPrice <= 0) serverPrice = 0 // Trial ücretsiz olabilir
    } else {
      serverPrice = teacher.hourlyRate
    }

    if (serverPrice < 0) {
      return NextResponse.json({ error: "Invalid price calculated" }, { status: 400 })
    }

    // Parse the slot time
    const startTime = new Date(slot)
    if (isNaN(startTime.getTime())) {
      return NextResponse.json({ error: "Invalid slot date" }, { status: 400 })
    }
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000) // +1 hour

    // 1. Create PENDING booking with server-calculated price
    const roomName = `room-${Date.now()}`
    const booking = await db.booking.create({
      data: {
        studentId: user.id,
        teacherId: teacher.id,
        startTime,
        endTime,
        status: "PENDING",
        price: serverPrice,
        dailyRoomName: roomName,
        dailyRoomUrl: process.env.LIVEKIT_URL || "ws://localhost:7880",
      }
    })

    // 2. Route based on Payment Provider
    if (paymentProvider === "iyzico") {
      console.log(`[PAYMENT] Initiating Iyzico flow for Booking: ${booking.id}`)
      
      return NextResponse.json({
        success: true,
        bookingId: booking.id,
        price: serverPrice,
        requiresIyzico: true,
        message: "Booking created, initializing Iyzico payment..."
      })
    }

    // 3. Try to create Stripe Checkout Session
    if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith("sk_")) {
      try {
        const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)
        // Calculate commission
        const commissionAmount = Math.round((serverPrice * 100) * (teacher.commissionRate || 0.15))
        const totalAmount = Math.round(serverPrice * 100)
        
        const sessionConfig: any = {
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: `Yoga Session with ${teacher.user.name || "Teacher"}`,
                  description: `${type === "trial" ? "Trial" : "Regular"} Session on ${startTime.toLocaleString()}`,
                },
                unit_amount: totalAmount,
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          success_url: `${process.env.NEXTAUTH_URL}/dashboard?booking_success=true&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.NEXTAUTH_URL}/checkout?teacher=${teacherSlug}&slot=${slot}&type=${type}`,
          client_reference_id: booking.id,
        }

        // If teacher has a Stripe Connect Account, route funds directly and take platform commission
        if (teacher.stripeConnectId) {
          sessionConfig.payment_intent_data = {
            application_fee_amount: commissionAmount,
            transfer_data: {
              destination: teacher.stripeConnectId,
            },
          }
        }

        const stripeSession = await stripe.checkout.sessions.create(sessionConfig)

        return NextResponse.json({
          success: true,
          bookingId: booking.id,
          price: serverPrice,
          stripeUrl: stripeSession.url,
          message: "Redirecting to Stripe"
        })
      } catch (stripeError) {
        console.error("Stripe error, falling back to instant confirmation:", stripeError)
        // If Stripe fails (e.g. invalid key), fallback to instant confirmation for demo purposes
      }
    }

    // 3. Fallback (If no Stripe key configured): Auto-confirm booking for testing
    await db.booking.update({
      where: { id: booking.id },
      data: { status: "CONFIRMED" }
    })

    return NextResponse.json({
      success: true,
      bookingId: booking.id,
      price: serverPrice,
      message: "Booking confirmed successfully (Test Mode)"
    })
  } catch (error: any) {
    console.error("[BOOKING_CREATE_ERROR]", error)
    return NextResponse.json({ error: error.message || "Internal Error" }, { status: 500 })
  }
}

// GET /api/bookings — Get current user's bookings
export async function GET(req: Request) {
  try {
    const user = await resolveUser(req)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const termsBlock = termsGate(user)
    if (termsBlock) return termsBlock

    const bookings = await db.booking.findMany({
      where: { studentId: user.id },
      include: {
        teacher: { include: { user: true } },
      },
      orderBy: { startTime: "desc" },
      take: 20,
    })

    return NextResponse.json(bookings)
  } catch (error: any) {
    console.error("[BOOKINGS_GET_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}
