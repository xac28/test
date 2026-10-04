'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, CalendarClock, Clock, Gauge, Loader2, Radio, Ticket, Users } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Cover, useDateFormat, useL } from '@/components/editorial';
import { formatPriceTR, WorkshopState } from '@/lib/workshops';

export interface WorkshopDetail {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string;
  category: string;
  level: string;
  mode: 'LIVE' | 'RECORDED';
  status: string;
  state: WorkshopState;
  startsAt: string | null;
  durationMin: number;
  priceUsd: number;
  capacity: number;
  seatsLeft: number;
  coverUrl: string | null;
  teacher: { id: string; name: string | null; image: string | null };
  isOwner: boolean;
  myEnrollment: 'RESERVED' | 'CONFIRMED' | 'CANCELLED' | null;
  videoUrl: string | null;
  hasAccess: boolean;
}

export default function WorkshopDetailView({
  workshop: w,
  loggedIn,
  liveRoomId,
}: {
  workshop: WorkshopDetail;
  loggedIn: boolean;
  liveRoomId: string | null;
}) {
  const L = useL();
  const f = useDateFormat();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enrolled = w.myEnrollment === 'CONFIRMED' || w.myEnrollment === 'RESERVED';
  const price = formatPriceTR(w.priceUsd) === 'Ücretsiz' ? L('Ücretsiz', 'Free') : formatPriceTR(w.priceUsd);

  const call = async (method: 'POST' | 'DELETE') => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workshops/${w.id}/enroll`, { method });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 && data.code === 'TERMS_REQUIRED') {
        router.push(`/accept-terms?next=/atolyeler/${w.slug}`);
        return;
      }
      if (!res.ok) throw new Error(data.error || L('İşlem başarısız oldu.', 'Something went wrong.'));
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const facts: { icon: React.ReactNode; label: string; value: string }[] = [
    ...(w.startsAt ? [{ icon: <CalendarClock size={18} />, label: L('Tarih', 'Date'), value: f.dateTime(w.startsAt) }] : []),
    { icon: <Clock size={18} />, label: L('Süre', 'Duration'), value: `${w.durationMin} ${L('dakika', 'minutes')}` },
    { icon: <Gauge size={18} />, label: L('Seviye', 'Level'), value: w.level },
    ...(w.mode === 'LIVE' ? [{ icon: <Users size={18} />, label: L('Kontenjan', 'Seats'), value: w.seatsLeft > 0 ? L(`${w.seatsLeft} / ${w.capacity} boş`, `${w.seatsLeft} of ${w.capacity} left`) : L('Doldu', 'Full') }] : []),
    { icon: <Ticket size={18} />, label: L('Ücret', 'Price'), value: price },
  ];

  const joinable = w.mode === 'LIVE' && (w.state === 'ongoing' || w.state === 'starting-soon');

  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 lg:px-12 pt-10">
        <Link href="/atolyeler" className="inline-flex items-center gap-2 text-sm text-sage-600 hover:text-ink mb-8">
          <ArrowLeft size={15} /> {L('Tüm atölyeler', 'All workshops')}
        </Link>

        <div className="grid lg:grid-cols-12 gap-12">
          <article className="lg:col-span-8">
            <p className="eyebrow mb-4">{w.category} · {w.mode === 'LIVE' ? L('Canlı atölye', 'Live workshop') : L('Kayıtlı atölye', 'Recorded workshop')}</p>
            <h1 data-testid="workshop-title" className="font-display font-light text-5xl md:text-6xl leading-[1.02]">{w.title}</h1>
            {w.subtitle && <p className="text-xl text-sage-600 mt-5 max-w-2xl leading-relaxed">{w.subtitle}</p>}

            <Cover src={w.coverUrl} tone={w.mode === 'RECORDED' ? 'clay' : 'sage'} label={w.title[0]} className="aspect-[16/9] mt-10" />

            {w.mode === 'RECORDED' && w.hasAccess && w.videoUrl && (
              <div className="mt-10">
                <p className="eyebrow mb-3">{L('Atölye videosu', 'Workshop video')}</p>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video data-testid="workshop-video" src={w.videoUrl} controls controlsList="nodownload" className="w-full bg-black aspect-video" />
              </div>
            )}

            <div className="mt-12 max-w-2xl">
              <h2 className="font-display text-3xl mb-4">{L('Bu atölyede', 'In this workshop')}</h2>
              <div className="text-lg leading-[1.8] text-sage-800 whitespace-pre-line">{w.description}</div>
            </div>

            <div className="mt-14 pt-8 border-t border-rule flex items-center gap-4">
              <Cover src={w.teacher.image} tone="sage" label={(w.teacher.name || 'E')[0]} className="w-16 h-16 rounded-full shrink-0 [&_span]:text-2xl" />
              <div>
                <p className="eyebrow mb-1">{L('Eğitmen', 'Teacher')}</p>
                <Link href={`/teachers/${w.teacher.id}`} className="font-display text-2xl hover:underline underline-offset-4 decoration-1">{w.teacher.name}</Link>
              </div>
            </div>
          </article>

          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-24 border border-ink bg-paper p-6">
              <dl className="space-y-4 pb-6 border-b border-rule">
                {facts.map((x) => (
                  <div key={x.label} className="flex items-start gap-3">
                    <span className="text-clay-500 mt-0.5">{x.icon}</span>
                    <div>
                      <dt className="eyebrow">{x.label}</dt>
                      <dd className="font-medium">{x.value}</dd>
                    </div>
                  </div>
                ))}
              </dl>

              <div className="pt-6 space-y-3" data-testid="enroll-panel">
                {w.state === 'cancelled' && <p className="text-clay-600 font-medium">{L('Bu atölye iptal edildi.', 'This workshop was cancelled.')}</p>}
                {w.state === 'ended' && <p className="text-sage-600">{L('Bu atölye sona erdi.', 'This workshop has ended.')}</p>}

                {w.isOwner ? (
                  <>
                    <p className="text-sm text-sage-600">{L('Bu sizin atölyeniz.', 'This is your workshop.')}</p>
                    {w.mode === 'LIVE' && w.state !== 'ended' && w.state !== 'cancelled' && (
                      <Link href={`/live/studio?workshop=${w.id}`} data-testid="start-workshop" className="w-full inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent-dark text-white py-3.5 text-sm font-semibold rounded-md">
                        <Radio size={16} /> {L('Atölyeyi yayınla', 'Start the broadcast')}
                      </Link>
                    )}
                    <Link href="/teach/workshops" className="block text-center text-sm font-semibold underline underline-offset-4">{L('Katılımcıları yönet', 'Manage participants')}</Link>
                  </>
                ) : !loggedIn ? (
                  <Link href={`/login?callbackUrl=/atolyeler/${w.slug}`} className="w-full inline-flex justify-center bg-ink text-cream py-3.5 text-sm font-semibold hover:bg-sage-800 rounded-md">
                    {L('Kayıt için giriş yapın', 'Sign in to enrol')}
                  </Link>
                ) : w.myEnrollment === 'CONFIRMED' ? (
                  <>
                    <p data-testid="enrolled-confirmed" className="font-medium text-emerald-700">✓ {L('Kaydınız onaylandı.', 'You are enrolled.')}</p>
                    {joinable && liveRoomId && (
                      <Link href={`/live/${liveRoomId}`} data-testid="join-workshop" className="w-full inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent-dark text-white py-3.5 text-sm font-semibold rounded-md">
                        <Radio size={16} /> {L('Yayına katıl', 'Join the broadcast')}
                      </Link>
                    )}
                    {joinable && !liveRoomId && <p className="text-sm text-sage-600">{L('Eğitmen yayına başladığında burada “Yayına katıl” düğmesi çıkar.', 'The join button appears here once the teacher goes live.')}</p>}
                    {w.state !== 'ended' && (
                      <button onClick={() => call('DELETE')} disabled={busy} className="text-sm text-sage-600 underline underline-offset-4 hover:text-clay-600">
                        {L('Kaydımı iptal et', 'Cancel my enrolment')}
                      </button>
                    )}
                  </>
                ) : w.myEnrollment === 'RESERVED' ? (
                  <>
                    <p data-testid="enrolled-reserved" className="font-medium text-amber-700">{L('Yeriniz ayrıldı.', 'Your seat is reserved.')}</p>
                    <p className="text-sm text-sage-600">{L('Eğitmen ödemenizi onayladığında katılımınız kesinleşir ve içeriğe erişirsiniz.', 'Once the teacher confirms your payment, your place is final and you get access.')}</p>
                    <button onClick={() => call('DELETE')} disabled={busy} className="text-sm text-sage-600 underline underline-offset-4 hover:text-clay-600">
                      {L('Rezervasyonu iptal et', 'Cancel reservation')}
                    </button>
                  </>
                ) : w.state !== 'cancelled' && w.state !== 'ended' ? (
                  <button
                    data-testid="enroll-button"
                    onClick={() => call('POST')}
                    disabled={busy || (w.mode === 'LIVE' && w.seatsLeft === 0)}
                    className="w-full inline-flex items-center justify-center gap-2 bg-ink text-cream py-3.5 text-sm font-semibold hover:bg-sage-800 disabled:opacity-50 rounded-md"
                  >
                    {busy && <Loader2 size={16} className="animate-spin" />}
                    {w.mode === 'LIVE' && w.seatsLeft === 0
                      ? L('Kontenjan doldu', 'Sold out')
                      : w.priceUsd > 0
                      ? L(`Yer ayır · ${price}`, `Reserve a seat · ${price}`)
                      : L('Ücretsiz kayıt ol', 'Enrol for free')}
                  </button>
                ) : null}

                {error && <p role="alert" className="text-sm text-clay-600">{error}</p>}
                {!enrolled && !w.isOwner && w.priceUsd > 0 && (
                  <p className="text-xs text-sage-500">{L('Ücretli atölyelerde yeriniz ayrılır; ödeme eğitmen tarafından onaylanınca katılımınız kesinleşir.', 'For paid workshops your seat is held until the teacher confirms payment.')}</p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
