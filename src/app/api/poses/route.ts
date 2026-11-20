import { NextResponse } from "next/server"
import { POSES, poseImage } from "@/lib/yoga-poses"
import { fold } from "@/lib/ai-knowledge"

export const dynamic = "force-dynamic"

// GET /api/poses?q=&category=&level=&style= → the pose library (used by the mobile app; the web renders it from the same data)
export async function GET(req: Request) {
  const u = new URL(req.url)
  const q = fold(u.searchParams.get("q") || "")
  const category = u.searchParams.get("category") || ""
  const level = u.searchParams.get("level") || ""
  const style = u.searchParams.get("style") || ""
  const list = POSES.filter((p) =>
    (!category || p.category === category) && (!level || p.level === level) && (!style || p.styles.includes(style)) &&
    (!q || fold(`${p.name} ${p.english} ${p.sanskrit} ${p.summary} ${p.benefits.join(" ")}`).includes(q)))
  return NextResponse.json(
    { poses: list.map((p) => ({ slug: p.slug, name: p.name, english: p.english, sanskrit: p.sanskrit, category: p.category, level: p.level, hold: p.hold, summary: p.summary, image: poseImage(p.slug) })), total: list.length },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } },
  )
}
