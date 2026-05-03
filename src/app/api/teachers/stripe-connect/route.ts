import { auth } from "@/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

// POST /api/teachers/stripe-connect
// Generates a Stripe Connect onboarding URL for the teacher
export async function POST() {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const teacher = await db.teacher.findUnique({
      where: { userId: session.user.id }
    })

    if (!teacher) {
      return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 })
    }

    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_SECRET_KEY.startsWith("sk_")) {
      return NextResponse.json({ error: "Stripe not configured on the server" }, { status: 500 })
    }

    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)

    let accountId = teacher.stripeConnectId

    // If the teacher doesn't have a Stripe Connect account yet, create one
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US', // In production, this should be dynamic based on the teacher's country
        email: session.user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      })
      accountId = account.id

      // Save to DB
      await db.teacher.update({
        where: { id: teacher.id },
        data: { stripeConnectId: accountId }
      })
    }

    // Generate onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.NEXTAUTH_URL}/dashboard?stripe_refresh=true`,
      return_url: `${process.env.NEXTAUTH_URL}/dashboard?stripe_success=true`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (error: any) {
    console.error("[STRIPE_CONNECT_ERROR]", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}
