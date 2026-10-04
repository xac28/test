'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, ArrowUpRight, Radio, Users } from 'lucide-react';
import { useI18n } from '@/i18n';
import { PersonAvatar } from '@/components/person-avatar';
import { formatPriceTR, WorkshopState } from '@/lib/workshops';

/** Pick a string by language: L('Merhaba', 'Hello'). */
export function useL() {
  const { locale } = useI18n();
  return (tr: string, en: string) => (locale === 'tr' ? tr : en);
}

export function useDateFormat() {
  const { locale } = useI18n();
  const loc = locale === 'tr' ? 'tr-TR' : 'en-GB';
  return {
    date: (d: string | Date) => new Date(d).toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' }),
    dateShort: (d: string | Date) => new Date(d).toLocaleDateString(loc, { day: 'numeric', month: 'short' }),
    dateTime: (d: string | Date) =>
      new Date(d).toLocaleString(loc, { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
    time: (d: string | Date) => new Date(d).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' }),
  };
}

/** Image with a tonal placeholder behind it, so the layout holds when a photo is missing or slow. */
export function Cover({
  src,
  alt = '',
  className = '',
  tone = 'sage',
  label,
  person,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  tone?: 'sage' | 'clay' | 'ink';
  label?: string;
  /** a person's name: without a photo an illustrated portrait is shown instead of the initial */
  person?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // a missing photo should still look designed: a soft tonal field with quiet concentric rings (and the initial)
  const palette =
    tone === 'clay'
      ? ['from-clay-100 to-clay-200 text-clay-400', 'from-clay-200 to-clay-100 text-clay-400']
      : tone === 'ink'
      ? ['from-sage-800 to-sage-900 text-sage-600']
      : ['from-sage-200 to-sage-100 text-sage-400', 'from-sage-100 to-clay-100 text-sage-400', 'from-clay-100 to-sage-200 text-sage-400'];
  const seed = Array.from(label || alt || '·').reduce((n, c) => n + c.charCodeAt(0), 0);
  const bg = `bg-gradient-to-br ${palette[seed % palette.length]}`;
  return (
    <div className={`relative overflow-hidden ${bg} ${className}`}>
      <svg className="absolute inset-0 w-full h-full opacity-[0.35]" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden>
        {[18, 30, 42, 56].map((r) => (
          <circle key={r} cx="50" cy="54" r={r} fill="none" stroke="currentColor" strokeWidth="0.35" />
        ))}
      </svg>
      {person && (!src || failed) && (
        <PersonAvatar name={person} size="full" rounded={false} className="absolute inset-0" />
      )}
      {label && !person && (
        <span className="absolute inset-0 flex items-center justify-center font-display text-7xl select-none opacity-80" aria-hidden>
          {label}
        </span>
      )}
      {src && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          onLoad={() => setLoaded(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 group-hover:scale-[1.03] ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  );
}

export function SectionHead({
  num,
  label,
  title,
  href,
  linkLabel,
}: {
  num: string;
  label: string;
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6 pb-6 mb-10 border-b border-ink">
      <div>
        <p className="eyebrow mb-3">
          <span className="text-clay-500">{num}</span> — {label}
        </p>
        <h2 className="font-display text-4xl md:text-5xl leading-[1.05] max-w-2xl">{title}</h2>
      </div>
      {href && linkLabel && (
        <Link href={href} className="group inline-flex items-center gap-2 text-sm font-semibold text-ink hover:text-clay-600">
          {linkLabel} <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}

export interface WorkshopCardData {
  slug: string;
  title: string;
  subtitle?: string | null;
  category: string;
  level: string;
  mode: 'LIVE' | 'RECORDED';
  state: WorkshopState;
  startsAt: string | Date | null;
  durationMin: number;
  priceUsd: number;
  seatsLeft: number;
  coverUrl?: string | null;
  teacher: { name: string | null };
}

export function WorkshopCard({ w }: { w: WorkshopCardData }) {
  const L = useL();
  const f = useDateFormat();
  const live = w.state === 'ongoing' || w.state === 'starting-soon';
  return (
    <Link href={`/atolyeler/${w.slug}`} data-testid="workshop-card" className="group block">
      <Cover src={w.coverUrl} tone={w.mode === 'RECORDED' ? 'clay' : 'sage'} label={w.title[0]} className="aspect-[4/3] mb-4" />
      <div className="flex items-center gap-3 mb-2 eyebrow">
        <span>{w.category}</span>
        <span className="text-rule">·</span>
        <span>{w.mode === 'LIVE' ? L('Canlı', 'Live') : L('Kayıtlı', 'Recorded')}</span>
        {live && (
          <span className="inline-flex items-center gap-1 text-accent">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            {w.state === 'ongoing' ? L('Şimdi canlı', 'Live now') : L('Birazdan', 'Soon')}
          </span>
        )}
      </div>
      <h3 className="font-display text-2xl leading-snug group-hover:underline underline-offset-4 decoration-1">{w.title}</h3>
      {w.subtitle && <p className="text-sm text-sage-600 mt-1 line-clamp-2">{w.subtitle}</p>}
      <div className="mt-3 flex items-center justify-between text-sm text-sage-600">
        <span>
          {w.startsAt ? f.dateTime(w.startsAt) : `${w.durationMin} ${L('dk', 'min')}`}
          {w.teacher.name ? ` · ${w.teacher.name}` : ''}
        </span>
        <span className="font-semibold text-ink">{formatPriceTR(w.priceUsd) === 'Ücretsiz' ? L('Ücretsiz', 'Free') : formatPriceTR(w.priceUsd)}</span>
      </div>
      {w.mode === 'LIVE' && w.seatsLeft <= 3 && w.state !== 'ended' && (
        <p className="mt-2 text-xs font-semibold text-clay-600">
          {w.seatsLeft === 0 ? L('Kontenjan doldu', 'Sold out') : L(`Son ${w.seatsLeft} kontenjan`, `${w.seatsLeft} seats left`)}
        </p>
      )}
    </Link>
  );
}

export interface ArticleCardData {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  coverUrl?: string | null;
  publishedAt: string | Date | null;
  author?: { name: string | null } | null;
}

export function ArticleCard({ a, large = false }: { a: ArticleCardData; large?: boolean }) {
  const f = useDateFormat();
  return (
    <Link href={`/icerikler/${a.slug}`} data-testid="article-card" className={`group block ${large ? 'md:col-span-2' : ''}`}>
      <Cover src={a.coverUrl} tone="clay" label={a.title[0]} className={`${large ? 'aspect-[16/9]' : 'aspect-[3/2]'} mb-4`} />
      <p className="eyebrow mb-2">
        {a.category}
        {a.publishedAt ? <span className="normal-case tracking-normal font-normal"> · {f.date(a.publishedAt)}</span> : null}
      </p>
      <h3 className={`font-display leading-snug group-hover:underline underline-offset-4 decoration-1 ${large ? 'text-4xl' : 'text-2xl'}`}>{a.title}</h3>
      <p className={`text-sage-600 mt-2 ${large ? 'text-base max-w-2xl' : 'text-sm line-clamp-3'}`}>{a.excerpt}</p>
    </Link>
  );
}

export function LiveNowCard({ title, teacher, viewers, id }: { title: string; teacher: string | null; viewers: number; id: string }) {
  const L = useL();
  return (
    <Link href={`/live/${id}`} className="group flex items-center justify-between gap-4 bg-stage text-cream p-5 hover:bg-stage-2 transition-colors">
      <div className="min-w-0">
        <p className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.18em] uppercase text-accent">
          <Radio size={13} /> {L('Şimdi canlıda', 'Live now')}
        </p>
        <p className="font-display text-2xl mt-1 truncate">{title}</p>
        <p className="text-sm text-cream/60 flex items-center gap-3 mt-0.5">
          {teacher}
          <span className="inline-flex items-center gap-1"><Users size={13} /> {viewers}</span>
        </p>
      </div>
      <ArrowUpRight size={22} className="shrink-0 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
    </Link>
  );
}
