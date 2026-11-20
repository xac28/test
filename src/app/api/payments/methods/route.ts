import { NextResponse } from "next/server"
import { iyzicoMode } from "@/lib/iyzico"
import { stripeReady } from "@/lib/payments"

export const dynamic = "force-dynamic"

// GET /api/payments/methods — which card providers are actually configured right now (no auth: public, no secrets returned).
// The lesson checkout page uses this to hide/disable a payment option instead of letting someone fill out the
// whole form and only find out it's unavailable after submitting.
export async function GET() {
  return NextResponse.json({ stripe: stripeReady(), iyzico: iyzicoMode() !== "off" })
}
