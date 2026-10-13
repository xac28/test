import { db } from "@/lib/db"
import { SITE_URL } from "@/lib/site"
import { itunesDuration, xmlEscape } from "@/lib/podcast"
import { stat } from "fs/promises"
import path from "path"

export const dynamic = "force-dynamic"

const abs = (u: string) => (u.startsWith("http") ? u : `${SITE_URL}${u}`)
/** podcast apps want the file size; we know it for our own uploads */
const sizeOf = (u: string) => (u.startsWith("/uploads/") ? stat(path.join(process.cwd(), "public", u)).then((s) => s.size).catch(() => 0) : Promise.resolve(0))

// GET /podcast/feed.xml — RSS 2.0 with the iTunes tags podcast apps expect
export async function GET() {
  const episodes = await db.podcastEpisode.findMany({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, take: 100 }).catch(() => [])
  const sizes = await Promise.all(episodes.map((e) => sizeOf(e.audioUrl)))
  const items = episodes.map((e, i) => `
    <item>
      <title>${xmlEscape(e.title)}</title>
      <link>${SITE_URL}/podcast/${e.slug}</link>
      <guid isPermaLink="false">${e.id}</guid>
      <pubDate>${(e.publishedAt ?? e.createdAt).toUTCString()}</pubDate>
      <description>${xmlEscape(e.description)}</description>
      <enclosure url="${xmlEscape(abs(e.audioUrl))}" type="${/\.(m4a|mp4)$/i.test(e.audioUrl) ? "audio/mp4" : /\.ogg$/i.test(e.audioUrl) ? "audio/ogg" : /\.wav$/i.test(e.audioUrl) ? "audio/wav" : "audio/mpeg"}" length="${sizes[i]}"/>${e.durationSec ? `\n      <itunes:duration>${itunesDuration(e.durationSec)}</itunes:duration>` : ""}${e.episodeNo ? `\n      <itunes:episode>${e.episodeNo}</itunes:episode>` : ""}${e.guest ? `\n      <itunes:author>${xmlEscape(e.guest)}</itunes:author>` : ""}${e.coverUrl ? `\n      <itunes:image href="${xmlEscape(abs(e.coverUrl))}"/>` : ""}
    </item>`).join("")
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AYA · Konuşmalar</title>
    <link>${SITE_URL}/podcast</link>
    <atom:link href="${SITE_URL}/podcast/feed.xml" rel="self" type="application/rss+xml"/>
    <language>tr</language>
    <description>Eğitmenler ve konuklarla nefes, beden ve zihin üzerine sohbetler.</description>
    <itunes:author>AYA</itunes:author>
    <itunes:category text="Health &amp; Fitness"/>
    <itunes:explicit>false</itunes:explicit>${items}
  </channel>
</rss>`
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=600" } })
}
