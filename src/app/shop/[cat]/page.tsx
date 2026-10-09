import { notFound } from "next/navigation"
import { ShopCategoryView } from "@/components/section-pages"
import { SHOP_BY_SLUG } from "@/lib/shop"

export function generateMetadata({ params }: { params: { cat: string } }) {
  const c = SHOP_BY_SLUG[params.cat]
  return { title: c ? `Shop · ${c.name.tr}` : "Shop" }
}

export default function ShopCategoryPage({ params }: { params: { cat: string } }) {
  const c = SHOP_BY_SLUG[params.cat]
  if (!c) notFound()
  return <ShopCategoryView c={c} />
}
