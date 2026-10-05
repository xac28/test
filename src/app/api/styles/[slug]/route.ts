import { NextResponse } from "next/server"
import { STYLE_BY_SLUG } from "@/lib/yoga-styles"
import { POSE_BY_SLUG, poseImage } from "@/lib/yoga-poses"

export const dynamic = "force-dynamic"

// GET /api/styles/:slug → one style, fully written, with its poses
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const s = STYLE_BY_SLUG[params.slug]
  if (!s) return NextResponse.json({ error: "Stil bulunamadı" }, { status: 404 })
  return NextResponse.json(
    { ...s, image: poseImage(s.cover), poses: s.poses.filter((p) => POSE_BY_SLUG[p]).map((p) => ({ slug: p, name: POSE_BY_SLUG[p].name, level: POSE_BY_SLUG[p].level, image: poseImage(p) })) },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } },
  )
}
