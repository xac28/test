export interface ShopCategory {
  slug: string
  name: { tr: string; en: string }
  tagline: { tr: string; en: string }
  plans: { tr: string[]; en: string[] }
  tone: string
}

export const SHOP_CATEGORIES: ShopCategory[] = [
  {
    slug: "wellness",
    name: { tr: "Wellness", en: "Wellness" },
    tagline: { tr: "Nefes, uyku ve gevşeme için sakin bir seçki.", en: "A calm selection for breath, sleep and relaxation." },
    plans: { tr: ["Gevşeme ve uyku ritüelleri", "Meditasyon yastıkları ve aksesuarlar", "Eğitmenlerimizin önerdiği ürünler"], en: ["Relaxation and sleep rituals", "Meditation cushions and accessories", "Products recommended by our teachers"] },
    tone: "from-teal-100 to-teal-50",
  },
  {
    slug: "matlar",
    name: { tr: "Matlar", en: "Mats" },
    tagline: { tr: "Pratiğinizin zemini: kaymaz, hafif, dayanıklı.", en: "The ground of your practice: grippy, light, durable." },
    plans: { tr: ["Kaymaz yoga matları", "Seyahat matları", "Blok, kayış ve yastıklar"], en: ["Non-slip yoga mats", "Travel mats", "Blocks, straps and bolsters"] },
    tone: "from-teal-200 to-teal-50",
  },
  {
    slug: "aromaterapi",
    name: { tr: "Aromaterapi", en: "Aromatherapy" },
    tagline: { tr: "Pratiğe eşlik eden kokular ve uçucu yağlar.", en: "Scents and essential oils to accompany practice." },
    plans: { tr: ["Uçucu yağlar ve difüzörler", "Tütsü ve mumlar", "Masaj ve bakım yağları"], en: ["Essential oils and diffusers", "Incense and candles", "Massage and care oils"] },
    tone: "from-teal-50 to-lilac-100",
  },
]

export const SHOP_BY_SLUG = Object.fromEntries(SHOP_CATEGORIES.map((c) => [c.slug, c])) as Record<string, ShopCategory>
