'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, Bell, Headphones, Megaphone, Mic, ShoppingBag } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { ArticleCardData, Cover, useDateFormat, useL } from '@/components/editorial';
import { NewsletterForm } from '@/components/newsletter';
import { Reveal, Stagger, StaggerItem } from '@/components/motion';
import { PodcastPlayer } from '@/components/podcast-player';
import { formatDuration } from '@/lib/podcast';
import { useI18n } from '@/i18n';

/** Shared blue header band + page frame for the section landing pages. */
export function SectionFrame({ eyebrow, title, intro, icon: Icon, children, compact = false }: { eyebrow: string; title: string; intro: string; icon: typeof Bell; children: React.ReactNode; compact?: boolean }) {
  return (
    <>
      <Navbar />
      <main>
        <section className="relative overflow-hidden bg-gradient-to-br from-teal-800 via-teal-700 to-teal-600 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(60%_90%_at_90%_0%,rgba(124,196,245,0.35),transparent_70%)]" aria-hidden />
          <div className={`relative max-w-7xl mx-auto px-6 lg:px-12 ${compact ? "pt-10 pb-6 lg:pt-12 lg:pb-8" : "py-16 lg:py-24"}`}>
            <p className="eyebrow !text-white/70 mb-4 inline-flex items-center gap-2"><Icon size={14} /> {eyebrow}</p>
            <h1 className={`font-display font-light leading-[1] max-w-3xl ${compact ? "text-4xl md:text-5xl" : "text-5xl md:text-7xl"}`}>{title}</h1>
            <p className={`text-white/80 max-w-xl leading-relaxed ${compact ? "mt-3" : "mt-6 text-lg"}`}>{intro}</p>
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

export interface EpisodeData {
  id: string; slug: string; title: string; description: string; audioUrl: string; coverUrl: string | null
  guest: string | null; durationSec: number | null; episodeNo: number | null; publishedAt: string | null; plays: number
}

export function PodcastView({ items }: { items: EpisodeData[] }) {
  const L = useL();
  const f = useDateFormat();
  return (
    <SectionFrame icon={Headphones} eyebrow="Podcast" title={L('Konuşmalar', 'Conversations')} intro={L('Eğitmenler ve konuklarla nefes, beden ve zihin üzerine sohbetler.', 'Conversations with teachers and guests on breath, body and mind.')}>
      <div className="-mt-2 mb-8 flex flex-wrap gap-3">
        <a href="/podcast/feed.xml" data-testid="podcast-rss" className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full border border-rule bg-white hover:border-ink"><Mic size={15} /> {L('RSS ile abone ol', 'Subscribe via RSS')}</a>
      </div>
      {items.length === 0 ? (
        <div data-testid="no-podcast" className="rounded-3xl border border-dashed border-rule bg-white py-20 px-6 text-center">
          <Headphones className="mx-auto text-teal-500 mb-4" size={34} />
          <p className="font-display text-3xl mb-2">{L('İlk bölüm yolda', 'The first episode is on its way')}</p>
          <p className="text-sage-600 max-w-md mx-auto">{L('Yeni bölümler yayımlandığında bültenle haber veriyoruz.', 'We announce new episodes through the newsletter.')}</p>
        </div>
      ) : (
        <ul className="space-y-6">
          {items.map((e) => (
            <li key={e.id} data-testid="episode-card" className="grid md:grid-cols-12 gap-6 rounded-3xl border border-rule bg-white p-5 md:p-6">
              <Link href={`/podcast/${e.slug}`} className="md:col-span-3 block">
                <Cover src={e.coverUrl} tone="clay" label={e.title[0]} className="aspect-square rounded-2xl" />
              </Link>
              <div className="md:col-span-9 min-w-0">
                <p className="eyebrow mb-1">
                  {e.episodeNo ? `${L('Bölüm', 'Episode')} ${e.episodeNo}` : L('Bölüm', 'Episode')}
                  {e.publishedAt ? <span className="normal-case tracking-normal font-normal text-sage-500"> · {f.date(e.publishedAt)}</span> : null}
                  {e.durationSec ? <span className="normal-case tracking-normal font-normal text-sage-500"> · {formatDuration(e.durationSec)}</span> : null}
                </p>
                <h2 className="font-display text-3xl leading-tight"><Link href={`/podcast/${e.slug}`} className="hover:underline underline-offset-4 decoration-1">{e.title}</Link></h2>
                {e.guest && <p className="text-sm text-teal-700 font-medium mt-1">{L('Konuk', 'Guest')}: {e.guest}</p>}
                <p className="text-sage-600 mt-2 line-clamp-3">{e.description}</p>
                <PodcastPlayer id={e.id} src={e.audioUrl} className="mt-4" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionFrame>
  );
}

export function PodcastEpisodeView({ e }: { e: EpisodeData }) {
  const L = useL();
  const f = useDateFormat();
  return (
    <SectionFrame icon={Headphones} eyebrow={`Podcast${e.episodeNo ? ` · ${L('Bölüm', 'Episode')} ${e.episodeNo}` : ''}`} title={e.title} intro={e.guest ? `${L('Konuk', 'Guest')}: ${e.guest}` : L('Konuşmalar', 'Conversations')}>
      <Link href="/podcast" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 mb-6"><ArrowLeft size={15} /> {L('Tüm bölümler', 'All episodes')}</Link>
      <article className="grid md:grid-cols-12 gap-8">
        <div className="md:col-span-4"><Cover src={e.coverUrl} tone="clay" label={e.title[0]} className="aspect-square rounded-3xl" /></div>
        <div className="md:col-span-8">
          <p className="text-sm text-sage-500 mb-4">{e.publishedAt ? f.date(e.publishedAt) : ''}{e.durationSec ? ` · ${formatDuration(e.durationSec)}` : ''} · {e.plays} {L('dinlenme', 'listens')}</p>
          <PodcastPlayer id={e.id} src={e.audioUrl} />
          <div className="mt-8 text-lg leading-relaxed text-sage-700 whitespace-pre-line">{e.description}</div>
        </div>
      </article>
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
