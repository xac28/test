import { db } from "@/lib/db"
import { emailGate } from "@/lib/email-verification"
import { suspensionOf } from "@/lib/policy"
import { NextResponse } from "next/server"
import { termsGate } from "@/lib/terms"
import { applyRateLimit } from "@/lib/api-protection"
import { RATE_LIMIT_WRITE } from "@/lib/rate-limit"
import { resolveUser } from "@/lib/auth-utils"
import { iyzicoMode } from "@/lib/iyzico"
import { memberLessonPrice } from "@/lib/subscriptions"
import { currentPlan } from "@/lib/subscription-server"

/** Confirming a paid lesson without a payment is only for development and test servers. */
const allowUnpaidBookings = () => process.env.NODE_ENV !== "production" || process.env.ALLOW_UNPAID_BOOKINGS === "1"

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
    const verifyBlock = await emailGate(user.id)
    if (verifyBlock) return verifyBlock

    const { teacherSlug, slot, type, paymentProvider } = await req.json()

    if (!teacherSlug || !slot || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // ── FIX #3: Sadece slug ile eşleşen öğretmen kullan, fallback yok ──
    const teachers = await db.teacher.findMany({
      include: { user: true }
    })

    const slugNormalized = teacherSlug.toLowerCase().replace(/-/g, " ")
    // database teachers are addressed by id, demo/legacy ones by a name slug
    const teacher = teachers.find(t => t.id === teacherSlug) ?? teachers.find(t =>
      t.user.name?.toLowerCase().replace(/-/g, " ") === slugNormalized
    )

    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found for the given slug" }, { status: 404 })
    }

    // Teachers who have not passed the admin trial broadcast cannot take students
    if (teacher.isTrialMode) {
      return NextResponse.json({ error: "Bu öğretmen henüz onaylanmadı.", code: "TEACHER_NOT_APPROVED" }, { status: 403 })
    }

    if (await suspensionOf(teacher.userId)) {
      return NextResponse.json({ error: "Bu eğitmen şu an ders alamıyor.", code: "TEACHER_UNAVAILABLE" }, { status: 409 })
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
    // Premium / Sınırsız members pay the discounted price
    serverPrice = memberLessonPrice(serverPrice, await currentPlan(user.id))

    // A paid lesson needs a way to pay. Without one, nothing is booked: confirming it anyway would give lessons away.
    const stripeKey = process.env.STRIPE_SECRET_KEY ?? ""
    const stripeReady = stripeKey.startsWith("sk_") && !/dummy|placeholder|change-?me|xxxx/i.test(stripeKey)
    const iyzicoReady = iyzicoMode() === "live"
    if (serverPrice > 0 && !stripeReady && !iyzicoReady && !allowUnpaidBookings()) {
      return NextResponse.json({ error: "Online ödeme şu an kullanılamıyor; lütfen daha sonra tekrar deneyin.", code: "PAYMENTS_OFF" }, { status: 503 })
    }
    if (serverPrice > 0 && paymentProvider === "iyzico" && !iyzicoReady && !allowUnpaidBookings()) {
      return NextResponse.json({ error: "Kartla ödeme (iyzico) şu an kullanılamıyor.", code: "PAYMENTS_OFF" }, { status: 503 })
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
    if (serverPrice > 0 && paymentProvider === "iyzico" && iyzicoReady) {
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
    if (serverPrice > 0 && stripeReady) {
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
        console.error("[BOOKING_STRIPE_ERROR]", stripeError)
        if (!allowUnpaidBookings()) {
          // never confirm an unpaid lesson: drop the pending booking so the slot is free again
          await db.booking.delete({ where: { id: booking.id } }).catch(() => {})
          return NextResponse.json({ error: "Ödeme başlatılamadı, lütfen tekrar deneyin.", code: "PAYMENT_START_FAILED" }, { status: 502 })
        }
      }
    }

    // 3. Free lessons — and, only on a development / test server (ALLOW_UNPAID_BOOKINGS=1), paid ones without a payment
    if (serverPrice > 0 && !allowUnpaidBookings()) {
      await db.booking.delete({ where: { id: booking.id } }).catch(() => {})
      return NextResponse.json({ error: "Online ödeme şu an kullanılamıyor; lütfen daha sonra tekrar deneyin.", code: "PAYMENTS_OFF" }, { status: 503 })
    }
    await db.booking.update({
      where: { id: booking.id },
      data: { status: "CONFIRMED" }
    })

    return NextResponse.json({
      success: true,
      bookingId: booking.id,
      price: serverPrice,
      message: serverPrice > 0 ? "Booking confirmed (test server: no payment taken)" : "Booking confirmed"
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
