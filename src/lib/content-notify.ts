import { db } from "@/lib/db"
import { SITE_URL } from "@/lib/site"
import { formatKurus } from "@/lib/shop"
import { sendCampaign } from "@/lib/newsletter"

type Kind = "article" | "podcast" | "product"

/**
 * Tells the newsletter about a newly published piece of content, at most once per item
 * (the `notifiedAt` column is claimed first, so two quick clicks never send twice).
 */
export async function notifyNewContent(kind: Kind, id: string, createdById?: string) {
  const table = kind === "article" ? db.article : kind === "podcast" ? db.podcastEpisode : db.product
  const claimed = await (table as any).updateMany({ where: { id, notifiedAt: null, status: "PUBLISHED" }, data: { notifiedAt: new Date() } })
  if (claimed.count === 0) return null

  let subject = "", body = "", href = ""
  if (kind === "article") {
    const a = await db.article.findUnique({ where: { id }, select: { title: true, excerpt: true, slug: true, category: true } })
    if (!a) return null
    subject = `${a.category}: ${a.title}`
    body = `${a.title}\n\n${a.excerpt}`
    href = `${SITE_URL}/icerikler/${a.slug}`
  } else if (kind === "podcast") {
    const e = await db.podcastEpisode.findUnique({ where: { id }, select: { title: true, description: true, slug: true, guest: true } })
    if (!e) return null
    subject = `Yeni podcast bölümü: ${e.title}`
    body = `${e.title}${e.guest ? ` — konuk: ${e.guest}` : ""}\n\n${e.description.slice(0, 400)}${e.description.length > 400 ? "…" : ""}`
    href = `${SITE_URL}/podcast/${e.slug}`
  } else {
    const p = await db.product.findUnique({ where: { id }, select: { name: true, summary: true, slug: true, priceKurus: true } })
    if (!p) return null
    subject = `AYA Shop’ta yeni: ${p.name}`
    body = `${p.name} (${formatKurus(p.priceKurus)})\n\n${p.summary}`
    href = `${SITE_URL}/shop/urun/${p.slug}`
  }
  const label = kind === "podcast" ? "Dinle" : kind === "product" ? "Ürüne bak" : "Oku"
  return sendCampaign({ subject, body, kind, refId: id, cta: { label, href }, createdById })
}
