import type { Product } from "@prisma/client"
import { parseImages } from "@/lib/shop"
import type { ProductData } from "@/components/shop-pages"

export const toProductData = (p: Product): ProductData => ({
  id: p.id, slug: p.slug, name: p.name, summary: p.summary, description: p.description, category: p.category,
  priceKurus: p.priceKurus, stock: p.stock, images: parseImages(p.images), featured: p.featured,
})
