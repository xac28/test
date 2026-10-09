import { NextResponse } from "next/server"
import { POSE_BY_SLUG, poseImage } from "@/lib/yoga-poses"
import { STYLE_BY_SLUG } from "@/lib/yoga-styles"

export const dynamic = "force-dynamic"

// GET /api/poses/:slug → one pose, fully written, with the poses that balance it and the styles it belongs to
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const p = POSE_BY_SLUG[params.slug]
  if (!p) return NextResponse.json({ error: "Poz bulunamadı" }, { status: 404 })
  return NextResponse.json(
    {
      ...p,
      image: poseImage(p.slug),
      counter: p.counter.filter((c) => POSE_BY_SLUG[c]).map((c) => ({ slug: c, name: POSE_BY_SLUG[c].name, image: poseImage(c) })),
      styles: p.styles.filter((s) => STYLE_BY_SLUG[s]).map((s) => ({ slug: s, name: STYLE_BY_SLUG[s].name })),
    },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } },
  )
}
