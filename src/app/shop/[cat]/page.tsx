import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { ShopCategoryView } from "@/components/shop-pages"
import { SHOP_BY_SLUG } from "@/lib/shop"
import { toProductData } from "@/lib/shop-data"

export const dynamic = "force-dynamic"

export function generateMetadata({ params }: { params: { cat: string } }) {
  const c = SHOP_BY_SLUG[params.cat]
  return { title: c ? `Shop · ${c.name.tr}` : "Shop" }
}

export default async function ShopCategoryPage({ params }: { params: { cat: string } }) {
  const c = SHOP_BY_SLUG[params.cat]
  if (!c) notFound()
  const products = await db.product.findMany({ where: { status: "PUBLISHED", category: c.slug }, orderBy: [{ featured: "desc" }, { createdAt: "desc" }] }).catch(() => [])
  return <ShopCategoryView c={c} products={products.map(toProductData)} />
}
