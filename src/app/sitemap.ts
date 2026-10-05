import type { MetadataRoute } from "next"
import { db } from "@/lib/db"
import { SITE_URL } from "@/lib/site"
import { POSES } from "@/lib/yoga-poses"
import { STYLES } from "@/lib/yoga-styles"
import { notSuspended } from "@/lib/policy"

export const dynamic = "force-dynamic"

const STATIC = ["/", "/yoga-stilleri", "/pozlar", "/nasil-calisir", "/sss", "/hakkimizda", "/ogretmenler-icin", "/teachers", "/atolyeler", "/live", "/icerikler", "/community", "/community/rules", "/pricing", "/become-teacher", "/terms", "/privacy"]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const url = (p: string) => `${SITE_URL}${p}`
  const items: MetadataRoute.Sitemap = [
    ...STATIC.map((p) => ({ url: url(p), lastModified: now, changeFrequency: (p === "/" ? "daily" : "weekly") as "daily" | "weekly", priority: p === "/" ? 1 : 0.7 })),
    ...STYLES.map((s) => ({ url: url(`/yoga-stilleri/${s.slug}`), lastModified: now, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...POSES.map((p) => ({ url: url(`/pozlar/${p.slug}`), lastModified: now, changeFrequency: "monthly" as const, priority: 0.6 })),
  ]
  try {
    const [teachers, workshops, articles] = await Promise.all([
      db.teacher.findMany({ where: { isTrialMode: false, user: { banned: false, ...notSuspended() } }, select: { id: true }, take: 2000 }),
      db.workshop.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true }, take: 2000 }),
      db.article.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true }, take: 2000 }),
    ])
    for (const t of teachers) items.push({ url: url(`/teachers/${t.id}`), lastModified: now, changeFrequency: "weekly", priority: 0.5 })
    for (const w of workshops) items.push({ url: url(`/atolyeler/${w.slug}`), lastModified: w.updatedAt, changeFrequency: "weekly", priority: 0.6 })
    for (const a of articles) items.push({ url: url(`/icerikler/${a.slug}`), lastModified: a.updatedAt, changeFrequency: "monthly", priority: 0.5 })
  } catch {
    // the static part of the map is still worth serving when the database is unreachable
  }
  return items
}
