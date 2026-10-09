import type { PodcastEpisode } from "@prisma/client"
import type { EpisodeData } from "@/components/section-pages"

export const toEpisodeData = (e: PodcastEpisode): EpisodeData => ({
  id: e.id, slug: e.slug, title: e.title, description: e.description, audioUrl: e.audioUrl, coverUrl: e.coverUrl,
  guest: e.guest, durationSec: e.durationSec, episodeNo: e.episodeNo, publishedAt: e.publishedAt ? e.publishedAt.toISOString() : null, plays: e.plays,
})
