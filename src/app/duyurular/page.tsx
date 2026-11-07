import { db } from "@/lib/db"
import { NewsView } from "@/components/section-pages"
import { NEWS_CATEGORIES } from "@/lib/articles"

export const dynamic = "force-dynamic"
export const metadata = { title: "Duyurular ve Haberler" }

export default async function NewsPage() {
  const rows = await db.article
    .findMany({
      where: { status: "PUBLISHED", category: { in: [...NEWS_CATEGORIES] } },
      select: { slug: true, title: true, excerpt: true, category: true, coverUrl: true, publishedAt: true, author: { select: { name: true } } },
      orderBy: { publishedAt: "desc" },
      take: 60,
    })
    .catch(() => [])
  return <NewsView items={rows.map((a) => ({ ...a, publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null }))} />
}
