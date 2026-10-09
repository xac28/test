import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { ProductDetailView } from "@/components/shop-pages"
import { JsonLd } from "@/components/json-ld"
import { SITE_URL } from "@/lib/site"
import { toProductData } from "@/lib/shop-data"

export const dynamic = "force-dynamic"

const load = (slug: string) => db.product.findFirst({ where: { slug, status: "PUBLISHED" } }).catch(() => null)

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const p = await load(params.slug)
  return p ? { title: `${p.name} · Shop`, description: p.summary } : { title: "Shop" }
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const p = await load(params.slug)
  if (!p) notFound()
  const data = toProductData(p)
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Product", name: p.name, description: p.summary, image: data.images.map((i) => (i.startsWith("http") ? i : `${SITE_URL}${i}`)), offers: { "@type": "Offer", priceCurrency: "TRY", price: (p.priceKurus / 100).toFixed(2), availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: `${SITE_URL}/shop/urun/${p.slug}` } }} />
      <ProductDetailView p={data} />
    </>
  )
}
