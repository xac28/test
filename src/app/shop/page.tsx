import { db } from "@/lib/db"
import { ShopIndexView } from "@/components/shop-pages"
import { toProductData } from "@/lib/shop-data"

export const dynamic = "force-dynamic"
export const metadata = { title: "Shop" }

export default async function ShopPage() {
  const [grouped, featured] = await Promise.all([
    db.product.groupBy({ by: ["category"], where: { status: "PUBLISHED" }, _count: true }).catch(() => []),
    db.product.findMany({ where: { status: "PUBLISHED", featured: true }, orderBy: { createdAt: "desc" }, take: 6 }).catch(() => []),
  ])
  return <ShopIndexView counts={Object.fromEntries(grouped.map((g) => [g.category, g._count]))} featured={featured.map(toProductData)} />
}
