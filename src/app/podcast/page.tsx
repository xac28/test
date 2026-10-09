import { db } from "@/lib/db"
import { PodcastView } from "@/components/section-pages"
import { PODCAST_CATEGORY } from "@/lib/articles"

export const dynamic = "force-dynamic"
export const metadata = { title: "Podcast · Konuşmalar" }

export default async function PodcastPage() {
  const rows = await db.article
    .findMany({
      where: { status: "PUBLISHED", category: PODCAST_CATEGORY },
      select: { slug: true, title: true, excerpt: true, category: true, coverUrl: true, publishedAt: true, author: { select: { name: true } } },
      orderBy: { publishedAt: "desc" },
      take: 30,
    })
    .catch(() => [])
  return <PodcastView items={rows.map((a) => ({ ...a, publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null }))} />
}
