'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PhotoBackdrop } from '@/components/motion';

export interface Slide { key: string; href: string; eyebrow: string; title: string; sources: readonly string[] }

const EVERY_MS = 6500;

/** Magazine-style feature slider: one big picture with a centred headline, dots below. Pauses on hover/focus; still for reduced motion. */
export function HeroSlider({ slides, label }: { slides: Slide[]; label: string }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = slides.length;
  const go = useCallback((to: number) => setI(((to % n) + n) % n), [n]);

  useEffect(() => {
    if (reduce || paused || n < 2) return;
    const id = setInterval(() => { if (!document.hidden) setI((x) => (x + 1) % n); }, EVERY_MS);
    return () => clearInterval(id);
  }, [reduce, paused, n, i]);

  return (
    <div
      data-testid="hero-slider"
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      className="group/slider relative aspect-[4/3] sm:aspect-[16/11] lg:aspect-auto lg:h-full lg:min-h-[520px] w-full overflow-hidden bg-teal-900"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {slides.map((s, k) => {
        const active = k === i;
        return (
          <Link
            key={s.key}
            href={s.href}
            data-testid="hero-slide"
            aria-hidden={!active}
            tabIndex={active ? 0 : -1}
            className={`absolute inset-0 flex items-center justify-center text-center text-white transition-opacity duration-[900ms] ease-out ${active ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
          >
            <div className={`absolute inset-0 ${active ? 'animate-kenburns' : ''}`}><PhotoBackdrop sources={s.sources} drift={false} /></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-black/10" aria-hidden />
            <div className={`relative px-8 max-w-[34rem] transition-all duration-[900ms] ease-out ${active ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}>
              <h2 className="font-display text-3xl md:text-[2.5rem] leading-tight [text-shadow:0_2px_18px_rgba(0,0,0,.45)] text-balance">{s.title}</h2>
              <div className="mt-6 mx-auto w-4/5 border-t border-white/70 pt-2.5 flex items-center justify-center gap-3 text-[11px] font-semibold uppercase tracking-[0.14em]">
                <span>{s.eyebrow}</span><span className="w-8 border-t border-white/70" aria-hidden /><span>AYA</span>
              </div>
            </div>
          </Link>
        );
      })}

      {n > 1 && (
        <>
          <button type="button" onClick={() => go(i - 1)} aria-label="Önceki" className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/85 text-ink flex items-center justify-center opacity-0 group-hover/slider:opacity-100 focus-visible:opacity-100 transition-opacity [@media(hover:none)]:opacity-100"><ChevronLeft size={20} /></button>
          <button type="button" onClick={() => go(i + 1)} aria-label="Sonraki" className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/85 text-ink flex items-center justify-center opacity-0 group-hover/slider:opacity-100 focus-visible:opacity-100 transition-opacity [@media(hover:none)]:opacity-100"><ChevronRight size={20} /></button>
          <div className="absolute left-3 bottom-1 z-20 flex" role="tablist" aria-label={label}>
            {slides.map((s, k) => (
              <button key={s.key} type="button" role="tab" aria-selected={k === i} aria-label={`${k + 1} / ${n}: ${s.title}`} onClick={() => go(k)} className="w-11 h-11 flex items-center justify-center">
                <span className={`block rounded-full border border-white transition-all duration-300 ${k === i ? 'w-3 h-3 bg-white' : 'w-2.5 h-2.5 bg-transparent'}`} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
