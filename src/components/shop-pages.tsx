'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Check, CreditCard, Minus, PackageCheck, Plus, ShoppingBag, Trash2, Truck } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Cover, useDateFormat, useL } from '@/components/editorial';
import { NewsletterForm } from '@/components/newsletter';
import { SectionFrame } from '@/components/section-pages';
import { CartEntry, addToCart, readCart, writeCart, CART_EVENT } from '@/lib/cart';
import { SHOP_CATEGORIES, ShopCategory, FREE_SHIPPING_KURUS, LOW_STOCK, MAX_LINE_QTY, ORDER_STATUS_LABEL, OrderStatusId, PAY_METHOD_LABEL, SHOP_BY_SLUG, calcTotals, formatKurus } from '@/lib/shop';

export interface ProductData { id: string; slug: string; name: string; summary: string; description: string; category: string; priceKurus: number; stock: number; images: string[]; featured: boolean }

export function ProductCard({ p }: { p: ProductData }) {
  const L = useL();
  return (
    <Link href={`/shop/urun/${p.slug}`} data-testid="product-card" className="group block rounded-3xl overflow-hidden border border-rule bg-white card-lift">
      <div className="relative">
        <Cover src={p.images[0]} tone="clay" label={p.name[0]} className="aspect-square" />
        {p.stock <= 0 && <span className="absolute top-3 left-3 text-[11px] font-bold uppercase tracking-wider bg-ink text-white px-2.5 py-1 rounded-full">{L('Tükendi', 'Sold out')}</span>}
        {p.stock > 0 && p.stock <= LOW_STOCK && <span className="absolute top-3 left-3 text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 px-2.5 py-1 rounded-full">{L(`Son ${p.stock} adet`, `Only ${p.stock} left`)}</span>}
      </div>
      <div className="p-5">
        <p className="eyebrow mb-1">{SHOP_BY_SLUG[p.category]?.name.tr ?? p.category}</p>
        <h3 className="font-display text-2xl leading-snug group-hover:underline underline-offset-4 decoration-1">{p.name}</h3>
        <p className="text-sm text-sage-600 mt-1 line-clamp-2">{p.summary}</p>
        <p className="mt-3 font-semibold text-teal-700">{formatKurus(p.priceKurus)}</p>
      </div>
    </Link>
  );
}

export function ShopIndexView({ counts, featured }: { counts: Record<string, number>; featured: ProductData[] }) {
  const L = useL();
  return (
    <SectionFrame icon={ShoppingBag} eyebrow="Shop" title={L('Pratiğinize eşlik edecek ürünler', 'Things to accompany your practice')} intro={L('Wellness, mat ve aromaterapi seçkilerimiz. Havale/EFT veya kapıda ödeme ile sipariş verebilirsiniz.', 'Our wellness, mat and aromatherapy selections. Order with bank transfer or pay on delivery.')}>
      <div className="grid md:grid-cols-3 gap-6 -mt-2">
        {SHOP_CATEGORIES.map((c) => (
          <Link key={c.slug} href={`/shop/${c.slug}`} data-testid={`shop-cat-${c.slug}`} className="group block rounded-3xl overflow-hidden border border-rule bg-white card-lift">
            <div className={`aspect-[4/3] bg-gradient-to-br ${c.tone} flex items-end p-6`}><span className="font-display text-5xl text-ink/90">{c.name.tr}</span></div>
            <div className="p-6">
              <p className="text-sage-600">{c.tagline.tr}</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-teal-700">{counts[c.slug] ? `${counts[c.slug]} ${L('ürün', 'products')}` : L('Çok yakında', 'Coming soon')}</p>
              <span className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-teal-700">{L('İncele', 'Explore')} <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" /></span>
            </div>
          </Link>
        ))}
      </div>
      {featured.length > 0 && (
        <section className="mt-14" data-testid="shop-featured">
          <h2 className="font-display text-4xl mb-6">{L('Öne çıkanlar', 'Featured')}</h2>
          <ProductGrid items={featured} />
        </section>
      )}
    </SectionFrame>
  );
}

export function ShopCategoryView({ c, products }: { c: ShopCategory; products: ProductData[] }) {
  const L = useL();
  return (
    <SectionFrame icon={ShoppingBag} eyebrow={`Shop · ${c.name.tr}`} title={c.name.tr} intro={c.tagline.tr}>
      <div className="flex flex-wrap gap-2 mb-10">
        {SHOP_CATEGORIES.map((x) => (
          <Link key={x.slug} href={`/shop/${x.slug}`} className={`px-4 py-2 text-sm rounded-full border transition-colors ${x.slug === c.slug ? 'bg-ink text-white border-ink' : 'border-rule text-sage-700 hover:border-ink bg-white'}`}>{x.name.tr}</Link>
        ))}
      </div>
      {products.length > 0 ? <ProductGrid items={products} /> : (
        <div data-testid="shop-soon" className="grid lg:grid-cols-12 gap-8 rounded-3xl border border-rule bg-white p-8 md:p-12">
          <div className="lg:col-span-6">
            <span className="inline-flex items-center gap-2 bg-teal-50 text-teal-700 text-xs font-bold tracking-wider uppercase px-3 py-1.5 rounded-full">{L('Çok yakında', 'Coming soon')}</span>
            <h2 className="font-display text-4xl mt-5 leading-tight">{L('Koleksiyon hazırlanıyor', 'Collection in preparation')}</h2>
            <p className="text-sage-600 mt-3 max-w-md">{L('Açıldığında haber vermemiz için e-posta adresinizi bırakın.', 'Leave your email and we will tell you when it opens.')}</p>
            <NewsletterForm className="mt-6" source={`shop:${c.slug}`} />
          </div>
          <div className="lg:col-span-6">
            <p className="eyebrow mb-4">{L('Neler gelecek', 'What is coming')}</p>
            <ul className="space-y-3">{c.plans.tr.map((p) => <li key={p} className="flex items-center gap-3 border-b border-rule pb-3 text-ink"><span className="w-2 h-2 rounded-full bg-accent" /> {p}</li>)}</ul>
          </div>
        </div>
      )}
    </SectionFrame>
  );
}

export function ProductGrid({ items }: { items: ProductData[] }) {
  return <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">{items.map((p) => <ProductCard key={p.id} p={p} />)}</div>;
}

export function ProductDetailView({ p }: { p: ProductData }) {
  const L = useL();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [active, setActive] = useState(0);
  const max = Math.min(MAX_LINE_QTY, Math.max(p.stock, 1));
  const cat = SHOP_BY_SLUG[p.category];
  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 lg:px-12 py-10 lg:py-14">
        <nav aria-label="breadcrumb" className="text-sm text-sage-500 mb-6"><Link href="/shop" className="hover:text-ink">Shop</Link> / <Link href={`/shop/${p.category}`} className="hover:text-ink">{cat?.name.tr ?? p.category}</Link></nav>
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-6">
            <Cover src={p.images[active]} tone="clay" label={p.name[0]} className="aspect-square rounded-3xl" />
            {p.images.length > 1 && (
              <div className="flex gap-3 mt-3">
                {p.images.map((src, i) => (
                  <button key={src} onClick={() => setActive(i)} aria-label={`${L('Görsel', 'Image')} ${i + 1}`} className={`w-20 h-20 rounded-xl overflow-hidden border-2 ${i === active ? 'border-ink' : 'border-transparent'}`}><Cover src={src} className="w-full h-full" /></button>
                ))}
              </div>
            )}
          </div>
          <div className="lg:col-span-6">
            <p className="eyebrow mb-2">{cat?.name.tr ?? p.category}</p>
            <h1 className="font-display font-light text-4xl md:text-5xl leading-tight" data-testid="product-name">{p.name}</h1>
            <p className="text-3xl font-semibold text-teal-700 mt-4" data-testid="product-price">{formatKurus(p.priceKurus)}</p>
            <p className="text-lg text-sage-600 mt-4">{p.summary}</p>
            <div className="mt-6">
              {p.stock <= 0 ? (
                <div data-testid="product-soldout" className="rounded-2xl bg-teal-50 p-5">
                  <p className="font-semibold">{L('Bu ürün şu an tükendi.', 'This product is sold out.')}</p>
                  <p className="text-sm text-sage-600 mb-3">{L('Stoğa girince haber verelim:', 'We will let you know when it is back:')}</p>
                  <NewsletterForm source={`shop:${p.slug}`} />
                </div>
              ) : (
                <>
                  <p className={`text-sm mb-3 ${p.stock <= LOW_STOCK ? 'text-amber-700 font-semibold' : 'text-sage-500'}`} data-testid="product-stock">{p.stock <= LOW_STOCK ? L(`Son ${p.stock} adet`, `Only ${p.stock} left`) : L('Stokta', 'In stock')}</p>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="inline-flex items-center border border-rule rounded-full bg-white">
                      <button aria-label={L('Azalt', 'Less')} onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-11 h-11 flex items-center justify-center"><Minus size={16} /></button>
                      <span className="w-8 text-center font-semibold" data-testid="product-qty">{qty}</span>
                      <button aria-label={L('Artır', 'More')} onClick={() => setQty((q) => Math.min(max, q + 1))} className="w-11 h-11 flex items-center justify-center"><Plus size={16} /></button>
                    </div>
                    <button data-testid="add-to-cart" onClick={() => { addToCart(p.id, qty, max); setAdded(true); }} className="btn-cta"><ShoppingBag size={17} /> {L('Sepete ekle', 'Add to cart')}</button>
                  </div>
                  {added && (
                    <p role="status" data-testid="added-note" className="mt-4 text-sm flex flex-wrap items-center gap-3 text-teal-700"><Check size={16} /> {L('Sepete eklendi.', 'Added to cart.')} <button onClick={() => router.push('/shop/sepet')} className="underline font-semibold">{L('Sepete git', 'View cart')}</button></p>
                  )}
                </>
              )}
            </div>
            <ul className="mt-8 space-y-2 text-sm text-sage-600">
              <li className="flex items-center gap-2"><Truck size={16} className="text-teal-600" /> {L(`${formatKurus(FREE_SHIPPING_KURUS)} ve üzeri siparişlerde kargo ücretsiz`, `Free shipping over ${formatKurus(FREE_SHIPPING_KURUS)}`)}</li>
              <li className="flex items-center gap-2"><PackageCheck size={16} className="text-teal-600" /> {L('Havale/EFT veya kapıda ödeme', 'Bank transfer or pay on delivery')}</li>
            </ul>
            <div className="mt-8 border-t border-rule pt-6 text-sage-700 leading-relaxed whitespace-pre-line">{p.description}</div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

interface CartProduct { id: string; slug: string; name: string; priceKurus: number; stock: number; image: string | null }

/** Reads the browser cart and joins it with fresh prices/stock from the server. */
function useCart() {
  const [entries, setEntries] = useState<CartEntry[] | null>(null);
  const [products, setProducts] = useState<Record<string, CartProduct>>({});
  const refresh = useCallback(async () => {
    const c = readCart();
    setEntries(c);
    if (c.length === 0) return setProducts({});
    const res = await fetch(`/api/shop/cart?ids=${c.map((e) => e.id).join(',')}`).then((r) => r.json()).catch(() => ({ products: [] }));
    const map: Record<string, CartProduct> = {};
    for (const p of res.products as CartProduct[]) map[p.id] = p;
    setProducts(map);
    // products that were unpublished or deleted drop out of the cart; quantities are capped to the stock
    const clean = c.filter((e) => map[e.id]).map((e) => ({ ...e, q: Math.max(1, Math.min(e.q, map[e.id].stock || 1, MAX_LINE_QTY)) }));
    if (clean.length !== c.length || clean.some((e, i) => e.q !== c[i].q)) { writeCart(clean); setEntries(clean); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { const h = () => setEntries(readCart()); window.addEventListener(CART_EVENT, h); return () => window.removeEventListener(CART_EVENT, h); }, []);
  const lines = (entries ?? []).filter((e) => products[e.id]).map((e) => ({ entry: e, p: products[e.id] }));
  const totals = calcTotals(lines.map((l) => ({ unitKurus: l.p.priceKurus, quantity: l.entry.q })));
  return { entries, lines, totals };
}

export function CartView() {
  const L = useL();
  const { entries, lines, totals } = useCart();
  const set = (id: string, q: number) => writeCart(readCart().map((e) => (e.id === id ? { ...e, q } : e)).filter((e) => e.q > 0));
  return (
    <SectionFrame compact icon={ShoppingBag} eyebrow="Shop" title={L('Sepetiniz', 'Your cart')} intro={L('Ürünlerinizi kontrol edin, ardından siparişi tamamlayın.', 'Check your items, then complete the order.')}>
      {entries === null ? <p className="text-sage-500">…</p> : lines.length === 0 ? (
        <div data-testid="cart-empty" className="rounded-3xl border border-dashed border-rule bg-white py-16 text-center">
          <ShoppingBag className="mx-auto text-teal-500 mb-3" size={32} />
          <p className="font-display text-3xl mb-2">{L('Sepetiniz boş', 'Your cart is empty')}</p>
          <Link href="/shop" className="btn-ghost mt-4">{L('Alışverişe başla', 'Start shopping')}</Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-12 gap-8">
          <ul className="lg:col-span-8 space-y-4">
            {lines.map(({ entry, p }) => (
              <li key={p.id} data-testid="cart-line" className="flex gap-4 rounded-2xl border border-rule bg-white p-4">
                <Cover src={p.image} tone="clay" label={p.name[0]} className="w-24 h-24 rounded-xl shrink-0" />
                <div className="flex-1 min-w-0">
                  <Link href={`/shop/urun/${p.slug}`} className="font-display text-xl hover:underline underline-offset-4 decoration-1">{p.name}</Link>
                  <p className="text-sm text-sage-500">{formatKurus(p.priceKurus)}</p>
                  <div className="mt-2 inline-flex items-center border border-rule rounded-full">
                    <button aria-label={L('Azalt', 'Less')} onClick={() => set(p.id, entry.q - 1)} className="w-10 h-10 flex items-center justify-center"><Minus size={14} /></button>
                    <span className="w-8 text-center text-sm font-semibold" data-testid="cart-qty">{entry.q}</span>
                    <button aria-label={L('Artır', 'More')} disabled={entry.q >= Math.min(p.stock, MAX_LINE_QTY)} onClick={() => set(p.id, entry.q + 1)} className="w-10 h-10 flex items-center justify-center disabled:opacity-30"><Plus size={14} /></button>
                  </div>
                </div>
                <div className="text-right flex flex-col justify-between">
                  <p className="font-semibold">{formatKurus(p.priceKurus * entry.q)}</p>
                  <button aria-label={L('Kaldır', 'Remove')} data-testid="cart-remove" onClick={() => set(p.id, 0)} className="self-end p-2 text-sage-500 hover:text-red-600"><Trash2 size={16} /></button>
                </div>
              </li>
            ))}
          </ul>
          <aside className="lg:col-span-4 rounded-2xl border border-rule bg-white p-6 h-fit">
            <h2 className="font-display text-2xl mb-4">{L('Özet', 'Summary')}</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt>{L('Ara toplam', 'Subtotal')}</dt><dd data-testid="cart-subtotal">{formatKurus(totals.subtotal)}</dd></div>
              <div className="flex justify-between"><dt>{L('Kargo', 'Shipping')}</dt><dd>{totals.shipping ? formatKurus(totals.shipping) : L('Ücretsiz', 'Free')}</dd></div>
              <div className="flex justify-between border-t border-rule pt-3 text-base font-semibold"><dt>{L('Toplam', 'Total')}</dt><dd data-testid="cart-total">{formatKurus(totals.total)}</dd></div>
            </dl>
            {totals.shipping > 0 && <p className="text-xs text-sage-500 mt-3">{L(`${formatKurus(FREE_SHIPPING_KURUS - totals.subtotal)} daha ekleyin, kargo ücretsiz olsun.`, `Add ${formatKurus(FREE_SHIPPING_KURUS - totals.subtotal)} more for free shipping.`)}</p>}
            <Link href="/shop/siparis" data-testid="to-checkout" className="btn-cta w-full justify-center mt-5">{L('Siparişi tamamla', 'Checkout')} <ArrowRight size={16} /></Link>
          </aside>
        </div>
      )}
    </SectionFrame>
  );
}

const fieldCls = 'w-full border border-rule bg-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ink';

export function CheckoutView({ defaults, card = false }: { defaults: { name: string; email: string }; card?: boolean }) {
  const L = useL();
  const router = useRouter();
  const { entries, lines, totals } = useCart();
  const [f, setF] = useState({ name: defaults.name, email: defaults.email, phone: '', address: '', city: '', note: '', payMethod: card ? 'kart' : 'havale', newsletter: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/shop/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, items: lines.map((l) => ({ productId: l.p.id, quantity: l.entry.q })) }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || L('Sipariş oluşturulamadı.', 'Could not place the order.'));
      writeCart([]);
      if (f.payMethod === 'kart') { try { sessionStorage.setItem(`aya-order-email-${data.code}`, f.email); } catch { /* private mode */ } }
      router.push(`/shop/siparis/${data.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <SectionFrame compact icon={ShoppingBag} eyebrow="Shop" title={L('Siparişi tamamla', 'Checkout')} intro={L('Teslimat bilgilerinizi girin. Ödeme yöntemini aşağıdan seçebilirsiniz.', 'Enter your delivery details and choose a payment method.')}>
      {entries !== null && lines.length === 0 ? (
        <p data-testid="checkout-empty" className="text-sage-600">{L('Sepetiniz boş. ', 'Your cart is empty. ')}<Link href="/shop" className="underline">{L('Alışverişe başlayın', 'Start shopping')}</Link></p>
      ) : (
        <form onSubmit={submit} className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <input className={fieldCls} placeholder={L('Ad soyad', 'Full name')} value={f.name} onChange={(e) => set('name', e.target.value)} required data-testid="co-name" autoComplete="name" />
              <input className={fieldCls} type="email" placeholder={L('E-posta', 'Email')} value={f.email} onChange={(e) => set('email', e.target.value)} required data-testid="co-email" autoComplete="email" />
            </div>
            <input className={fieldCls} placeholder={L('Telefon (05xx…)', 'Phone')} value={f.phone} onChange={(e) => set('phone', e.target.value)} required data-testid="co-phone" autoComplete="tel" />
            <input className={fieldCls} placeholder={L('İl / ilçe', 'City')} value={f.city} onChange={(e) => set('city', e.target.value)} required data-testid="co-city" autoComplete="address-level2" />
            <textarea className={fieldCls} rows={3} placeholder={L('Açık adres', 'Address')} value={f.address} onChange={(e) => set('address', e.target.value)} required data-testid="co-address" autoComplete="street-address" />
            <input className={fieldCls} placeholder={L('Sipariş notu (isteğe bağlı)', 'Order note (optional)')} value={f.note} onChange={(e) => set('note', e.target.value)} maxLength={300} />
            <fieldset className="space-y-2">
              <legend className="eyebrow mb-2">{L('Ödeme yöntemi', 'Payment method')}</legend>
              {((card ? ['kart', 'havale', 'kapida'] : ['havale', 'kapida']) as ('kart' | 'havale' | 'kapida')[]).map((m) => (
                <label key={m} className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer ${f.payMethod === m ? 'border-ink bg-white' : 'border-rule bg-white/60'}`}>
                  <input type="radio" name="pay" checked={f.payMethod === m} onChange={() => set('payMethod', m)} className="mt-1" data-testid={`co-pay-${m}`} />
                  <span><span className="font-semibold">{PAY_METHOD_LABEL[m]}</span><span className="block text-sm text-sage-500">{m === 'kart' ? L('Güvenli ödeme sayfasında kartınızla hemen ödersiniz (iyzico). 2 saat içinde tamamlanmazsa sipariş iptal olur.', 'Pay right away with your card on a secure page (iyzico). Unpaid orders are cancelled after 2 hours.') : m === 'havale' ? L('Sipariş sonrası IBAN bilgisi e-postayla gelir; 3 gün içinde ödenmezse sipariş iptal olur.', 'IBAN details arrive by email; unpaid orders are cancelled after 3 days.') : L('Ürünü teslim alırken kuryeye ödersiniz.', 'You pay the courier on delivery.')}</span></span>
                </label>
              ))}
            </fieldset>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.newsletter} onChange={(e) => set('newsletter', e.target.checked)} /> {L('Yeni ürün ve duyurulardan haberdar olmak istiyorum', 'Keep me posted on new products')}</label>
          </div>
          <aside className="lg:col-span-5 rounded-2xl border border-rule bg-white p-6 h-fit">
            <h2 className="font-display text-2xl mb-4">{L('Sipariş özeti', 'Order summary')}</h2>
            <ul className="space-y-2 text-sm mb-4">{lines.map(({ entry, p }) => <li key={p.id} className="flex justify-between gap-3"><span>{p.name} × {entry.q}</span><span>{formatKurus(p.priceKurus * entry.q)}</span></li>)}</ul>
            <div className="border-t border-rule pt-3 text-sm space-y-1">
              <div className="flex justify-between"><span>{L('Kargo', 'Shipping')}</span><span>{totals.shipping ? formatKurus(totals.shipping) : L('Ücretsiz', 'Free')}</span></div>
              <div className="flex justify-between text-base font-semibold"><span>{L('Toplam', 'Total')}</span><span data-testid="co-total">{formatKurus(totals.total)}</span></div>
            </div>
            {error && <p role="alert" data-testid="co-error" className="mt-4 text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={busy || lines.length === 0} data-testid="co-submit" className="btn-cta w-full justify-center mt-5 disabled:opacity-60">{busy ? '…' : L('Siparişi onayla', 'Place order')}</button>
          </aside>
        </form>
      )}
    </SectionFrame>
  );
}

export interface OrderView { code: string; status: OrderStatusId; payMethod: string; createdAt: string; city: string; trackingNo: string | null; subtotalKurus: number; shippingKurus: number; totalKurus: number; items: { name: string; unitKurus: number; quantity: number }[]; bank: { name: string | null; iban: string | null }; cardEnabled?: boolean }

const STEPS: OrderStatusId[] = ['PENDING_PAYMENT', 'PAID', 'SHIPPED', 'DELIVERED'];

export function OrderStatusView({ o }: { o: OrderView }) {
  const L = useL();
  const result = useSearchParams().get('odeme');
  const f = useDateFormat();
  const cod = o.payMethod === 'kapida';
  const steps = cod ? STEPS.filter((s) => s !== 'PAID') : STEPS;
  const at = steps.indexOf(o.status);
  return (
    <SectionFrame compact icon={PackageCheck} eyebrow={L('Sipariş', 'Order')} title={o.code} intro={`${f.date(o.createdAt)} · ${PAY_METHOD_LABEL[o.payMethod] ?? o.payMethod}`}>
      <div data-testid="order-status" data-status={o.status} className="rounded-3xl border border-rule bg-white p-6 md:p-8">
        {o.status === 'CANCELLED' ? (
          <p className="font-display text-3xl text-red-700">{ORDER_STATUS_LABEL.CANCELLED}</p>
        ) : (
          <ol className="grid sm:grid-cols-4 gap-4">
            {steps.map((s, i) => (
              <li key={s} className={`rounded-2xl p-4 border ${i <= at ? 'border-ink bg-teal-50' : 'border-rule text-sage-400'}`}>
                <span className="text-xs font-bold">{i + 1}</span>
                <p className="font-semibold">{ORDER_STATUS_LABEL[s]}</p>
              </li>
            ))}
          </ol>
        )}
        {result && (
          <p role="status" data-testid="pay-result" data-result={result} className={`mt-6 rounded-2xl p-4 text-sm ${result === 'ok' ? 'bg-green-50 text-green-900' : 'bg-amber-50 text-amber-900'}`}>
            {result === 'ok' ? L('Ödemeniz alındı, teşekkürler! Siparişiniz hazırlanıyor.', 'Payment received, thank you! We are preparing your order.') : result === 'iptal' ? L('Ödeme süresinde tamamlanmadığı için sipariş iptal edilmişti. Tutarı iade edeceğiz; dilerseniz yeni bir sipariş verebilirsiniz.', 'The order had been cancelled because the payment took too long. We will refund the amount; you can place a new order.') : L('Ödeme tamamlanamadı. Aşağıdan tekrar deneyebilirsiniz.', 'The payment was not completed. You can try again below.')}
          </p>
        )}
        {o.status === 'PENDING_PAYMENT' && o.payMethod === 'kart' && o.cardEnabled && <CardPayPanel code={o.code} />}
        {o.status === 'PENDING_PAYMENT' && !cod && o.payMethod !== 'kart' && (
          <div className="mt-6 rounded-2xl bg-teal-50 p-5 text-sm" data-testid="bank-info">
            <p className="font-semibold mb-1">{L('Ödeme bilgileri', 'Payment details')}</p>
            {o.bank.name && <p>{L('Hesap sahibi', 'Account holder')}: {o.bank.name}</p>}
            <p>IBAN: {o.bank.iban ?? L('e-postanıza gönderilecektir', 'will be sent by email')}</p>
            <p>{L('Açıklama', 'Reference')}: <strong>{o.code}</strong></p>
          </div>
        )}
        {o.trackingNo && <p className="mt-6 flex items-center gap-2"><Truck size={16} /> {L('Kargo takip no', 'Tracking no')}: <strong data-testid="tracking-no">{o.trackingNo}</strong></p>}
        <ul className="mt-6 divide-y divide-rule text-sm">
          {o.items.map((i) => <li key={i.name} className="flex justify-between py-2"><span>{i.name} × {i.quantity}</span><span>{formatKurus(i.unitKurus * i.quantity)}</span></li>)}
          <li className="flex justify-between py-2"><span>{L('Kargo', 'Shipping')}</span><span>{o.shippingKurus ? formatKurus(o.shippingKurus) : L('Ücretsiz', 'Free')}</span></li>
          <li className="flex justify-between py-2 font-semibold"><span>{L('Toplam', 'Total')}</span><span>{formatKurus(o.totalKurus)}</span></li>
        </ul>
        <p className="text-sm text-sage-500 mt-6">{L('Bu sayfanın bağlantısını saklayın; siparişinizin durumunu buradan izleyebilirsiniz. Teslimat şehri: ', 'Keep this link to follow your order. Delivery city: ')}{o.city}</p>
      </div>
    </SectionFrame>
  );
}


/** Runs the scripts of a payment form that was inserted as HTML (they do not run on their own). */
function PayForm({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    box.innerHTML = html;
    box.querySelectorAll('script').forEach((old) => {
      const s = document.createElement('script');
      for (const a of Array.from(old.attributes)) s.setAttribute(a.name, a.value);
      s.text = old.text;
      old.replaceWith(s);
    });
  }, [html]);
  return <div ref={ref} id="iyzipay-checkout-form" data-testid="pay-form" className="responsive" />;
}

function CardPayPanel({ code }: { code: string }) {
  const L = useL();
  const [email, setEmail] = useState('');
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const start = useCallback(async (mail: string) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/shop/orders/${code}/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: mail }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || L('Ödeme başlatılamadı.', 'Could not start the payment.'));
      setHtml(data.htmlContent);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [code, L]);
  // right after ordering the e-mail is still known: the payment page opens by itself (once, even when React runs effects twice)
  const auto = useRef(false);
  useEffect(() => {
    if (auto.current) return;
    auto.current = true;
    let saved = '';
    try { saved = sessionStorage.getItem(`aya-order-email-${code}`) || ''; } catch { /* private mode */ }
    if (saved) { setEmail(saved); start(saved); }
  }, [code, start]);
  return (
    <div className="mt-6 rounded-2xl bg-teal-50 p-5 text-sm" data-testid="card-pay">
      <p className="font-semibold mb-2 flex items-center gap-2"><CreditCard size={16} /> {L('Kartla ödeme', 'Pay by card')}</p>
      {html ? <PayForm html={html} /> : (
        <form onSubmit={(e) => { e.preventDefault(); start(email.trim()); }} className="space-y-3">
          <p>{L('Ödemeyi başlatmak için siparişte kullandığınız e-posta adresini yazın.', 'Enter the e-mail address you used for the order to start the payment.')}</p>
          <input className={fieldCls} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={L('E-posta', 'Email')} data-testid="pay-email" />
          <button type="submit" disabled={busy} className="btn-cta disabled:opacity-60" data-testid="pay-start">{busy ? '…' : L('Ödemeye geç', 'Go to payment')}</button>
        </form>
      )}
      {error && <p role="alert" data-testid="pay-error" className="mt-3 text-red-700">{error}</p>}
    </div>
  );
}
