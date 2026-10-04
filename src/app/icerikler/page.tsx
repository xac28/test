import { db } from "@/lib/db"
import ArticlesView from "@/components/articles-view"

export const dynamic = "force-dynamic"
export const metadata = { title: "İçerikler" }

export default async function ArticlesPage({ searchParams }: { searchParams: { category?: string } }) {
  const category = searchParams.category || null
  const rows = await db.article
    .findMany({
      where: { status: "PUBLISHED", ...(category ? { category } : {}) },
      select: { slug: true, title: true, excerpt: true, category: true, coverUrl: true, publishedAt: true, author: { select: { name: true } } },
      orderBy: { publishedAt: "desc" },
      take: 60,
    })
    .catch(() => [])

  return <ArticlesView items={rows.map((a) => ({ ...a, publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null }))} category={category} />
}
