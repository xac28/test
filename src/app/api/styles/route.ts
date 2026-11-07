import { NextResponse } from "next/server"
import { STYLES } from "@/lib/yoga-styles"
import { poseImage } from "@/lib/yoga-poses"

export const dynamic = "force-dynamic"

// GET /api/styles → the yoga styles (cards for the mobile app)
export async function GET() {
  return NextResponse.json(
    { styles: STYLES.map((s) => ({ slug: s.slug, name: s.name, tagline: s.tagline, intensity: s.intensity, pace: s.pace, level: s.level, duration: s.duration, image: poseImage(s.cover) })) },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } },
  )
}
