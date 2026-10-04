import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import ArticleView from "@/components/article-view"
import { parseArticleBody, readingMinutes } from "@/lib/articles"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const a = await db.article.findFirst({ where: { slug: params.slug, status: "PUBLISHED" }, select: { title: true, excerpt: true } }).catch(() => null)
  return a ? { title: a.title, description: a.excerpt } : { title: "Yazı" }
}

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const a = await db.article.findFirst({
    where: { slug: params.slug, status: "PUBLISHED" },
    include: { author: { select: { name: true } } },
  })
  if (!a) notFound()

  const related = await db.article.findMany({
    where: { status: "PUBLISHED", id: { not: a.id } },
    select: { slug: true, title: true, excerpt: true, category: true, coverUrl: true, publishedAt: true, author: { select: { name: true } } },
    orderBy: [{ publishedAt: "desc" }],
    take: 3,
  })

  return (
    <ArticleView
      article={{
        slug: a.slug,
        title: a.title,
        excerpt: a.excerpt,
        category: a.category,
        coverUrl: a.coverUrl,
        publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
        author: a.author.name,
        minutes: readingMinutes(a.body),
        blocks: parseArticleBody(a.body),
      }}
      related={related.map((r) => ({ ...r, publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null }))}
    />
  )
}
