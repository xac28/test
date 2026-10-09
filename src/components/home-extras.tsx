'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Pause, Play, Wind } from 'lucide-react';
import { useL } from '@/components/editorial';
import { POSES, poseImage } from '@/lib/yoga-poses';

const PHASES = [
  { key: 'in', tr: 'Nefes al', en: 'Breathe in', ms: 4000, scale: 1 },
  { key: 'hold', tr: 'Tut', en: 'Hold', ms: 4000, scale: 1 },
  { key: 'out', tr: 'Nefes ver', en: 'Breathe out', ms: 6000, scale: 0.55 },
] as const;

/** A one-minute 4-4-6 breathing break: an orb that swells and settles with the breath. */
export function BreathBreak() {
  const L = useL();
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(2);
  const [cycles, setCycles] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!running) return;
    const step = (i: number) => {
      setPhase(i);
      timer.current = setTimeout(() => {
        const next = (i + 1) % PHASES.length;
        if (next === 0) setCycles((c) => c + 1);
        step(next);
      }, PHASES[i].ms);
    };
    step(0);
    return () => clearTimeout(timer.current);
  }, [running]);

  const p = PHASES[phase];
  const scale = running ? p.scale : 0.55;
  return (
    <div data-testid="breath-break" className="relative h-full overflow-hidden rounded-3xl bg-gradient-to-br from-teal-900 via-teal-800 to-teal-600 text-white p-7 flex flex-col">
      <div className="absolute inset-0 bg-[radial-gradient(70%_70%_at_50%_45%,rgba(124,196,245,0.28),transparent_70%)]" aria-hidden />
      <p className="relative eyebrow !text-white/60 inline-flex items-center gap-2"><Wind size={14} /> {L('Nefes molası', 'Breathing break')}</p>
      <div className="relative flex-1 flex items-center justify-center py-6 min-h-[200px]">
        <div
          className="absolute w-44 h-44 rounded-full border border-white/25"
          aria-hidden
        />
        <div
          className="w-44 h-44 rounded-full bg-gradient-to-br from-white/90 to-sky-200/70 shadow-[0_0_60px_rgba(124,196,245,0.55)] flex items-center justify-center motion-reduce:transition-none"
          style={{ transform: `scale(${scale})`, transition: `transform ${running ? p.ms : 600}ms ease-in-out` }}
        >
          <span aria-live="polite" data-testid="breath-label" className="font-display text-2xl text-teal-900 select-none">
            {running ? L(p.tr, p.en) : L('Hazır mısın?', 'Ready?')}
          </span>
        </div>
      </div>
      <div className="relative flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          data-testid="breath-toggle"
          className="inline-flex items-center gap-2 rounded-full bg-white text-teal-800 hover:bg-teal-50 px-5 py-2.5 text-sm font-semibold transition-colors"
        >
          {running ? <><Pause size={15} /> {L('Durdur', 'Pause')}</> : <><Play size={15} /> {L('Başla', 'Start')}</>}
        </button>
        <span className="text-xs text-white/60">{cycles > 0 ? L(`${cycles} döngü`, `${cycles} cycles`) : '4 · 4 · 6'}</span>
      </div>
    </div>
  );
}

/** A different pose every day, picked from the library. */
export function PoseOfTheDay() {
  const L = useL();
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const d = new Date();
    const day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
    setIdx(day % POSES.length);
  }, []);
  const p = POSES[idx];
  return (
    <Link href={`/pozlar/${p.slug}`} data-testid="pose-of-day" className="group relative block h-full min-h-[320px] overflow-hidden rounded-3xl bg-gradient-to-br from-teal-100 to-teal-50 border border-rule card-lift">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={poseImage(p.slug)} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-teal-900/90 via-teal-900/30 to-transparent" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 p-6 text-white">
        <p className="eyebrow !text-white/70 mb-2">{L('Günün pozu', 'Pose of the day')}</p>
        <h3 className="font-display text-3xl leading-tight">{p.name}</h3>
        <p className="text-sm text-white/75 italic">{p.sanskrit}</p>
        <p className="text-sm text-white/85 mt-2 line-clamp-2">{p.summary}</p>
        <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold">{L('Poza bak', 'See the pose')} <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" /></span>
      </div>
    </Link>
  );
}
