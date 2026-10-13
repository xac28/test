import { db } from "@/lib/db"
import { PodcastView } from "@/components/section-pages"
import { toEpisodeData } from "@/lib/podcast-server"

export const dynamic = "force-dynamic"
export const metadata = { title: "Podcast · Konuşmalar", alternates: { types: { "application/rss+xml": "/podcast/feed.xml" } } }

export default async function PodcastPage() {
  const rows = await db.podcastEpisode
    .findMany({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, take: 50 })
    .catch(() => [])
  return <PodcastView items={rows.map(toEpisodeData)} />
}
