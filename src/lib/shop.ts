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

// ── Products, prices and orders ────────────────────────────────────────────

export const SHOP_SLUGS = SHOP_CATEGORIES.map((c) => c.slug)
export const LOW_STOCK = 3
export const FREE_SHIPPING_KURUS = 50_000
export const SHIPPING_KURUS = 4_990
export const MAX_LINE_QTY = 20
/** unpaid bank-transfer orders are cancelled (and their stock released) after this many days */
export const UNPAID_ORDER_DAYS = 3

/** 24990 → "₺249,90" */
export const formatKurus = (k: number) => (k / 100).toLocaleString("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: k % 100 === 0 ? 0 : 2 })

export function parseImages(json: string | null | undefined): string[] {
  try {
    const v = JSON.parse(json || "[]")
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []
  } catch {
    return []
  }
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")
const okUrl = (u: string) => u.length <= 500 && (/^\/uploads\/[a-z]+\/[A-Za-z0-9._-]+$/.test(u) || /^https?:\/\/[^\s]+$/i.test(u))

export interface ProductInput { name?: unknown; summary?: unknown; description?: unknown; category?: unknown; priceTL?: unknown; stock?: unknown; images?: unknown; status?: unknown; featured?: unknown; notify?: unknown }
export type ProductValidation =
  | { ok: true; data: { name: string; summary: string; description: string; category: string; priceKurus: number; stock: number; images: string; status: "DRAFT" | "PUBLISHED"; featured: boolean }; notify: boolean }
  | { ok: false; error: string }

export function validateProductInput(i: ProductInput): ProductValidation {
  const name = str(i.name)
  if (name.length < 2 || name.length > 160) return { ok: false, error: "Ürün adı 2–160 karakter olmalı." }
  const summary = str(i.summary)
  if (summary.length < 10 || summary.length > 300) return { ok: false, error: "Kısa açıklama 10–300 karakter olmalı." }
  const description = str(i.description)
  if (description.length < 20 || description.length > 8000) return { ok: false, error: "Açıklama 20–8000 karakter olmalı." }
  const category = str(i.category)
  if (!SHOP_SLUGS.includes(category)) return { ok: false, error: "Geçerli bir kategori seçin." }
  const tl = Number(typeof i.priceTL === "string" ? i.priceTL.replace(",", ".") : i.priceTL)
  if (!Number.isFinite(tl) || tl <= 0 || tl > 1_000_000) return { ok: false, error: "Fiyat 0’dan büyük olmalı." }
  const stock = Number(i.stock ?? 0)
  if (!Number.isInteger(stock) || stock < 0 || stock > 100_000) return { ok: false, error: "Stok 0 veya daha büyük bir tam sayı olmalı." }
  const imgs = Array.isArray(i.images) ? i.images.map(str).filter(Boolean) : []
  if (imgs.length > 8) return { ok: false, error: "En fazla 8 görsel eklenebilir." }
  if (imgs.some((u) => !okUrl(u))) return { ok: false, error: "Görsel bağlantılarından biri geçersiz." }
  return {
    ok: true,
    data: { name, summary, description, category, priceKurus: Math.round(tl * 100), stock, images: JSON.stringify(imgs), status: i.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT", featured: i.featured === true },
    notify: i.notify === true,
  }
}

export interface CartLine { productId: string; quantity: number }
export function calcTotals(lines: { unitKurus: number; quantity: number }[]) {
  const subtotal = lines.reduce((n, l) => n + l.unitKurus * l.quantity, 0)
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_KURUS ? 0 : SHIPPING_KURUS
  return { subtotal, shipping, total: subtotal + shipping }
}

export interface OrderInput { name?: unknown; email?: unknown; phone?: unknown; address?: unknown; city?: unknown; note?: unknown; payMethod?: unknown; items?: unknown }
export type OrderValidation =
  | { ok: true; data: { name: string; email: string; phone: string; address: string; city: string; note: string | null; payMethod: "havale" | "kapida"; items: CartLine[] } }
  | { ok: false; error: string }

export function validateOrderInput(i: OrderInput): OrderValidation {
  const name = str(i.name)
  if (name.length < 3 || name.length > 120) return { ok: false, error: "Ad soyad girin." }
  const email = str(i.email).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 190) return { ok: false, error: "Geçerli bir e-posta adresi girin." }
  const phone = str(i.phone).replace(/[\s()-]/g, "")
  if (!/^\+?\d{10,15}$/.test(phone)) return { ok: false, error: "Geçerli bir telefon numarası girin." }
  const address = str(i.address)
  if (address.length < 10 || address.length > 400) return { ok: false, error: "Açık adres 10–400 karakter olmalı." }
  const city = str(i.city)
  if (city.length < 2 || city.length > 80) return { ok: false, error: "İl / ilçe girin." }
  const note = str(i.note) || null
  if (note && note.length > 300) return { ok: false, error: "Not en fazla 300 karakter olabilir." }
  if (i.payMethod !== "havale" && i.payMethod !== "kapida") return { ok: false, error: "Ödeme yöntemini seçin." }
  if (!Array.isArray(i.items) || i.items.length === 0) return { ok: false, error: "Sepetiniz boş." }
  if (i.items.length > 20) return { ok: false, error: "Tek siparişte en fazla 20 farklı ürün olabilir." }
  const merged = new Map<string, number>()
  for (const it of i.items as any[]) {
    const productId = str(it?.productId)
    const quantity = Number(it?.quantity)
    if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QTY) return { ok: false, error: `Ürün adedi 1–${MAX_LINE_QTY} arası olmalı.` }
    merged.set(productId, Math.min(MAX_LINE_QTY, (merged.get(productId) ?? 0) + quantity))
  }
  return { ok: true, data: { name, email, phone, address, city, note, payMethod: i.payMethod, items: [...merged].map(([productId, quantity]) => ({ productId, quantity })) } }
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
export function makeOrderCode(rand: () => number = Math.random): string {
  return "AYA-" + Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)]).join("")
}

export type OrderStatusId = "PENDING_PAYMENT" | "PAID" | "SHIPPED" | "DELIVERED" | "CANCELLED"
export const ORDER_STATUS_LABEL: Record<OrderStatusId, string> = {
  PENDING_PAYMENT: "Ödeme bekleniyor", PAID: "Ödendi", SHIPPED: "Kargoda", DELIVERED: "Teslim edildi", CANCELLED: "İptal edildi",
}
export const PAY_METHOD_LABEL: Record<string, string> = { havale: "Havale / EFT", kapida: "Kapıda ödeme" }

/**
 * Which status an order may move to next.
 * Bank transfer: pending → paid → shipped → delivered. Pay on delivery is collected by the courier, so it goes
 * pending → shipped → delivered and may still be cancelled while on the road (refused parcel).
 */
export function nextStatuses(from: OrderStatusId, payMethod: string): OrderStatusId[] {
  const cod = payMethod === "kapida"
  switch (from) {
    case "PENDING_PAYMENT": return cod ? ["SHIPPED", "CANCELLED"] : ["PAID", "CANCELLED"]
    case "PAID": return ["SHIPPED", "CANCELLED"]
    case "SHIPPED": return cod ? ["DELIVERED", "CANCELLED"] : ["DELIVERED"]
    default: return []
  }
}
export const canTransition = (from: OrderStatusId, to: OrderStatusId, payMethod: string) => nextStatuses(from, payMethod).includes(to)
