'use client';

import Link from 'next/link';
import { ArrowRight, Film } from 'lucide-react';
import { SectionFrame } from '@/components/section-pages';
import { RecordingsList } from '@/components/recordings-list';
import { useL } from '@/components/editorial';

/** "Dersler › Kayıt": my lesson recordings (30 days) and the way to the recorded workshops. */
export function RecordedLessonsView({ role }: { role: 'student' | 'teacher' | null }) {
  const L = useL();
  return (
    <SectionFrame icon={Film} eyebrow={L('Dersler · Kayıt', 'Lessons · Recordings')} title={L('Ders kayıtların', 'Your lesson recordings')} intro={L('Kaydedilen derslerini 30 gün boyunca indirebilirsin. Kayıtlara yalnızca dersin öğretmeni ve öğrencisi ulaşır.', 'Download your recorded lessons for 30 days. Only the teacher and the student of a lesson can open its recording.')}>
      <div className="grid lg:grid-cols-12 gap-8">
        <section className="lg:col-span-8" data-testid="my-recordings">
          {role ? <RecordingsList role={role} /> : (
            <div data-testid="recordings-login" className="rounded-3xl border border-dashed border-rule bg-white p-10 text-center">
              <Film className="mx-auto text-teal-500 mb-3" size={32} />
              <p className="font-display text-3xl mb-2">{L('Kayıtları görmek için giriş yapın', 'Sign in to see your recordings')}</p>
              <Link href="/login?callbackUrl=%2Fdersler%2Fkayit" className="btn-cta mt-4">{L('Giriş yap', 'Sign in')}</Link>
            </div>
          )}
        </section>
        <aside className="lg:col-span-4 space-y-4">
          <Link href="/atolyeler?mode=RECORDED" className="group block rounded-2xl border border-rule bg-white p-6 card-lift">
            <p className="eyebrow mb-2">{L('Kayıtlı atölyeler', 'Recorded workshops')}</p>
            <p className="font-display text-2xl leading-snug">{L('İstediğin zaman izle', 'Watch whenever you like')}</p>
            <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-teal-700">{L('Göz at', 'Browse')} <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" /></span>
          </Link>
          <Link href="/live" className="group block rounded-2xl border border-rule bg-white p-6 card-lift">
            <p className="eyebrow mb-2">{L('Canlı dersler', 'Live lessons')}</p>
            <p className="font-display text-2xl leading-snug">{L('Şu an yayında olanlar', 'On air right now')}</p>
            <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-teal-700">{L('Yayınlara git', 'Go to live')} <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" /></span>
          </Link>
        </aside>
      </div>
    </SectionFrame>
  );
}
