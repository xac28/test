import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// GET /api/ai/status → { enabled, engine }: the guide is our own engine, always available
export async function GET() {
  return NextResponse.json({ enabled: true, engine: "aya" })
}
