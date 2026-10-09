import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { PodcastEpisodeView } from "@/components/section-pages"
import { JsonLd } from "@/components/json-ld"
import { SITE_URL } from "@/lib/site"
import { toEpisodeData } from "@/lib/podcast-server"

export const dynamic = "force-dynamic"

async function load(slug: string) {
  return db.podcastEpisode.findFirst({ where: { slug, status: "PUBLISHED" } }).catch(() => null)
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const e = await load(params.slug)
  return e ? { title: `${e.title} · Podcast`, description: e.description.slice(0, 160) } : { title: "Podcast" }
}

export default async function EpisodePage({ params }: { params: { slug: string } }) {
  const e = await load(params.slug)
  if (!e) notFound()
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "PodcastEpisode", name: e.title, description: e.description.slice(0, 300), url: `${SITE_URL}/podcast/${e.slug}`, datePublished: e.publishedAt?.toISOString(), associatedMedia: { "@type": "AudioObject", contentUrl: e.audioUrl.startsWith("http") ? e.audioUrl : `${SITE_URL}${e.audioUrl}` } }} />
      <PodcastEpisodeView e={toEpisodeData(e)} />
    </>
  )
}
