'use client';

import Link from 'next/link';
import { ArrowRight, Bell, Headphones, Megaphone, ShoppingBag } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { ArticleCard, ArticleCardData, useDateFormat, useL } from '@/components/editorial';
import { NewsletterForm } from '@/components/newsletter';
import { Reveal, Stagger, StaggerItem } from '@/components/motion';
import { SHOP_CATEGORIES, ShopCategory } from '@/lib/shop';
import { useI18n } from '@/i18n';

/** Shared blue header band + page frame for the section landing pages. */
export function SectionFrame({ eyebrow, title, intro, icon: Icon, children }: { eyebrow: string; title: string; intro: string; icon: typeof Bell; children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main>
        <section className="relative overflow-hidden bg-gradient-to-br from-teal-800 via-teal-700 to-teal-600 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(60%_90%_at_90%_0%,rgba(124,196,245,0.35),transparent_70%)]" aria-hidden />
          <div className="relative max-w-7xl mx-auto px-6 lg:px-12 py-16 lg:py-24">
            <p className="eyebrow !text-white/70 mb-4 inline-flex items-center gap-2"><Icon size={14} /> {eyebrow}</p>
            <h1 className="font-display font-light text-5xl md:text-7xl leading-[1] max-w-3xl">{title}</h1>
            <p className="mt-6 text-lg text-white/80 max-w-xl leading-relaxed">{intro}</p>
          </div>
          <WaveDivider className="text-cream" />
        </section>
        <div className="max-w-7xl mx-auto px-6 lg:px-12 pb-16">{children}</div>
        <NewsletterBand />
      </main>
      <Footer />
    </>
  );
}

export function WaveDivider({ className = '' }: { className?: string }) {
  return (
    <svg className={`block w-full h-10 md:h-16 -mb-px ${className}`} viewBox="0 0 1440 64" preserveAspectRatio="none" aria-hidden>
      <path fill="currentColor" d="M0,40 C240,72 480,8 720,32 C960,56 1200,64 1440,24 L1440,64 L0,64 Z" />
    </svg>
  );
}

/** The "Gelişmeleri takip edin!" band from the sketch. */
export function NewsletterBand() {
  const L = useL();
  return (
    <section data-testid="newsletter-band" className="relative overflow-hidden bg-gradient-to-br from-teal-900 via-teal-800 to-teal-700 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(50%_80%_at_85%_20%,rgba(91,156,239,0.35),transparent_70%)]" aria-hidden />
      <div className="relative max-w-7xl mx-auto px-6 lg:px-12 py-16 grid lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-6">
          <p className="eyebrow !text-white/60 mb-3">{L('Bülten', 'Newsletter')}</p>
          <h2 className="font-display text-4xl md:text-5xl leading-[1.05]">{L('Gelişmeleri takip edin!', 'Follow the updates!')}</h2>
          <p className="mt-4 text-white/75 max-w-md">{L('Yeni atölyeler, yazılar, podcast bölümleri ve duyurular e-postanıza gelsin. İstediğiniz zaman ayrılabilirsiniz.', 'New workshops, articles, podcast episodes and announcements in your inbox. Leave any time.')}</p>
        </div>
        <div className="lg:col-span-6"><NewsletterForm tone="dark" /></div>
      </div>
    </section>
  );
}

export function ShopIndexView() {
  const L = useL();
  const { locale } = useI18n();
  return (
    <SectionFrame icon={ShoppingBag} eyebrow="Shop" title={L('Pratiğinize eşlik edecek ürünler', 'Things to accompany your practice')} intro={L('Wellness, mat ve aromaterapi koleksiyonlarımız hazırlanıyor. Açıldığında ilk siz haberdar olun.', 'Our wellness, mat and aromatherapy collections are being prepared. Be the first to know when they open.')}>
      <Stagger className="grid md:grid-cols-3 gap-6 -mt-2">
        {SHOP_CATEGORIES.map((c) => (
          <StaggerItem key={c.slug}><ShopCard c={c} lang={locale === 'tr' ? 'tr' : 'en'} /></StaggerItem>
        ))}
      </Stagger>
    </SectionFrame>
  );
}

function ShopCard({ c, lang }: { c: ShopCategory; lang: 'tr' | 'en' }) {
  return (
    <Link href={`/shop/${c.slug}`} className="group block rounded-3xl overflow-hidden border border-rule bg-white card-lift">
      <div className={`aspect-[4/3] bg-gradient-to-br ${c.tone} flex items-end p-6`}>
        <span className="font-display text-5xl text-ink/90">{c.name[lang]}</span>
      </div>
      <div className="p-6">
        <p className="text-sage-600">{c.tagline[lang]}</p>
        <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-teal-700">{lang === 'tr' ? 'İncele' : 'Explore'} <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" /></span>
      </div>
    </Link>
  );
}

export function ShopCategoryView({ c }: { c: ShopCategory }) {
  const L = useL();
  const { locale } = useI18n();
  const lang = locale === 'tr' ? 'tr' : 'en';
  return (
    <SectionFrame icon={ShoppingBag} eyebrow={`Shop · ${c.name[lang]}`} title={c.name[lang]} intro={c.tagline[lang]}>
      <div className="flex flex-wrap gap-2 mb-10">
        {SHOP_CATEGORIES.map((x) => (
          <Link key={x.slug} href={`/shop/${x.slug}`} className={`px-4 py-2 text-sm rounded-full border transition-colors ${x.slug === c.slug ? 'bg-ink text-white border-ink' : 'border-rule text-sage-700 hover:border-ink bg-white'}`}>{x.name[lang]}</Link>
        ))}
      </div>
      <Reveal>
        <div data-testid="shop-soon" className="grid lg:grid-cols-12 gap-8 rounded-3xl border border-rule bg-white p-8 md:p-12">
          <div className="lg:col-span-6">
            <span className="inline-flex items-center gap-2 bg-teal-50 text-teal-700 text-xs font-bold tracking-wider uppercase px-3 py-1.5 rounded-full"><Bell size={13} /> {L('Çok yakında', 'Coming soon')}</span>
            <h2 className="font-display text-4xl mt-5 leading-tight">{L('Koleksiyon hazırlanıyor', 'Collection in preparation')}</h2>
            <p className="text-sage-600 mt-3 max-w-md">{L('Açıldığında haber vermemiz için e-posta adresinizi bırakın.', 'Leave your email and we will tell you when it opens.')}</p>
            <NewsletterForm className="mt-6" />
          </div>
          <div className="lg:col-span-6">
            <p className="eyebrow mb-4">{L('Neler gelecek', 'What is coming')}</p>
            <ul className="space-y-3">
              {c.plans[lang].map((p) => (
                <li key={p} className="flex items-center gap-3 border-b border-rule pb-3 text-ink"><span className="w-2 h-2 rounded-full bg-accent" /> {p}</li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>
    </SectionFrame>
  );
}

export function PodcastView({ items }: { items: ArticleCardData[] }) {
  const L = useL();
  return (
    <SectionFrame icon={Headphones} eyebrow="Podcast" title={L('Konuşmalar', 'Conversations')} intro={L('Eğitmenler ve konuklarla nefes, beden ve zihin üzerine sohbetler.', 'Conversations with teachers and guests on breath, body and mind.')}>
      {items.length === 0 ? (
        <div data-testid="no-podcast" className="rounded-3xl border border-dashed border-rule bg-white py-20 px-6 text-center">
          <Headphones className="mx-auto text-teal-500 mb-4" size={34} />
          <p className="font-display text-3xl mb-2">{L('İlk bölüm yolda', 'The first episode is on its way')}</p>
          <p className="text-sage-600 max-w-md mx-auto">{L('Yeni bölümler yayımlandığında bültenle haber veriyoruz.', 'We announce new episodes through the newsletter.')}</p>
        </div>
      ) : (
        <Stagger className="grid md:grid-cols-3 gap-x-8 gap-y-12">
          {items.map((a) => <StaggerItem key={a.slug}><ArticleCard a={a} /></StaggerItem>)}
        </Stagger>
      )}
    </SectionFrame>
  );
}

export function NewsView({ items }: { items: ArticleCardData[] }) {
  const L = useL();
  const f = useDateFormat();
  return (
    <SectionFrame icon={Megaphone} eyebrow={L('Duyurular / Haberler', 'Announcements / News')} title={L('Duyurular ve haberler', 'Announcements and news')} intro={L('AYA’dan son gelişmeler, yeni özellikler ve topluluk haberleri.', 'The latest from AYA: new features and community news.')}>
      {items.length === 0 ? (
        <div data-testid="no-news" className="rounded-3xl border border-dashed border-rule bg-white py-20 text-center">
          <p className="font-display text-3xl mb-2">{L('Şimdilik duyuru yok', 'No announcements yet')}</p>
          <p className="text-sage-600">{L('Yeni gelişmeler burada yayımlanacak.', 'News will appear here.')}</p>
        </div>
      ) : (
        <ul className="divide-y divide-rule border-y border-rule bg-white rounded-2xl">
          {items.map((a) => (
            <li key={a.slug}>
              <Link href={`/icerikler/${a.slug}`} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-6 py-5 hover:bg-teal-50 transition-colors">
                <span className="eyebrow w-28 shrink-0">{a.category}</span>
                <span className="font-display text-2xl flex-1 min-w-[12rem]">{a.title}</span>
                {a.publishedAt && <span className="text-sm text-sage-500">{f.date(a.publishedAt)}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionFrame>
  );
}
