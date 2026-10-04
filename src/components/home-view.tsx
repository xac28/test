'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowRight, Check, Radio, Video, CalendarCheck, Sparkles } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { ArticleCard, ArticleCardData, Cover, LiveNowCard, SectionHead, WorkshopCard, WorkshopCardData, useL } from '@/components/editorial';
import { Aurora, Marquee, MeditationScene, PhotoBackdrop, Reveal, Stagger, StaggerItem } from '@/components/motion';
import { PHOTOS } from '@/lib/photos';

export interface HomeData {
  live: { id: string; title: string; viewers: number; teacher: string | null } | null;
  workshops: WorkshopCardData[];
  articles: ArticleCardData[];
  teachers: { id: string; name: string; image: string | null; bio: string | null; specialties: string[] }[];
}

export default function HomeView({ data }: { data: HomeData }) {
  const L = useL();
  const { status } = useSession();
  const visitor = status === 'unauthenticated';

  return (
    <>
      <Navbar />
      <main>
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b border-rule">
          <div className="absolute inset-0 bg-gradient-to-b from-cream via-cream to-sage-100" aria-hidden />
          <PhotoBackdrop sources={PHOTOS.hero} opacity={0.22} />
          <div className="absolute inset-0 bg-gradient-to-r from-cream via-cream/85 to-cream/30" aria-hidden />
          <Aurora />
          <div className="relative max-w-7xl mx-auto px-6 lg:px-12 pt-14 pb-14 lg:pt-20 lg:pb-20 grid lg:grid-cols-12 gap-6 lg:gap-10 items-center">
            <div className="lg:col-span-7">
              <p className="eyebrow mb-6 animate-fade-up" style={{ animationDelay: '0.05s', opacity: 0 }}>{L('Yoga · Nefes · Meditasyon', 'Yoga · Breath · Meditation')}</p>
              <h1 className="font-display font-light text-[3.1rem] sm:text-7xl lg:text-[5.4rem] leading-[0.98] tracking-tight animate-fade-up" style={{ animationDelay: '0.15s', opacity: 0 }}>
                {L('Nefes, beden ve zihin için', 'A live school for breath,')}{' '}
                <em className="italic text-clay-500">{L('canlı bir okul.', 'body and mind.')}</em>
              </h1>
              <p className="mt-8 text-lg text-sage-600 max-w-xl leading-relaxed animate-fade-up" style={{ animationDelay: '0.3s', opacity: 0 }}>
                {L(
                  'Sertifikalı eğitmenlerle birebir dersler, herkese açık canlı yayınlar ve küçük gruplarla atölyeler. Evinizden, kendi temponuzla.',
                  'One-to-one lessons with certified teachers, open live broadcasts and small-group workshops. From home, at your own pace.'
                )}
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-4 animate-fade-up" style={{ animationDelay: '0.45s', opacity: 0 }}>
                {visitor ? (
                  <Link href="/login?mode=register" data-testid="hero-join" className="cta pulse-cta inline-flex items-center gap-2 bg-accent text-white px-8 py-4 text-base font-semibold hover:bg-accent-dark rounded-md">
                    {L('Ücretsiz üye ol', 'Join for free')} <ArrowRight size={18} />
                  </Link>
                ) : (
                  <Link href="/atolyeler" className="cta inline-flex items-center gap-2 bg-ink text-cream px-8 py-4 text-base font-semibold hover:bg-sage-800 rounded-md">
                    {L('Atölyelere göz at', 'Browse workshops')} <ArrowRight size={18} />
                  </Link>
                )}
                {visitor && (
                  <Link href="/atolyeler" className="cta inline-flex items-center gap-2 border border-ink/80 px-7 py-4 text-base font-semibold hover:bg-ink hover:text-cream transition-colors rounded-md">
                    {L('Atölyelere göz at', 'Browse workshops')}
                  </Link>
                )}
                <Link href="/teachers" className="link-grow px-1 py-3.5 text-sm font-semibold">
                  {L('Eğitmen bul', 'Find a teacher')}
                </Link>
              </div>
              <ul className="mt-10 flex flex-wrap gap-x-7 gap-y-2 text-sm text-sage-700 animate-fade-up" style={{ animationDelay: '0.6s', opacity: 0 }}>
                {[L('İlk deneme dersi yarı fiyat', 'First trial lesson half price'), L('Canlı yayın ve sohbet', 'Live streams and chat'), L('Dersin kaydı 30 gün indirilebilir', 'Lesson recordings for 30 days')].map((t) => (
                  <li key={t} className="flex items-center gap-2"><Check size={15} className="text-clay-500" /> {t}</li>
                ))}
              </ul>
            </div>
            <div className="lg:col-span-5">
              <div className="relative h-[380px] sm:h-[460px] lg:h-[540px] -mx-4 lg:mx-0">
                <MeditationScene variant="figure" className="absolute inset-0" />
              </div>
              {data.live ? (
                <LiveNowCard id={data.live.id} title={data.live.title} teacher={data.live.teacher} viewers={data.live.viewers} />
              ) : (
                <div className="bg-sage-900 text-cream/70 px-5 py-4 text-sm rounded-md">
                  {L('Şu anda canlı yayın yok.', 'Nobody is live right now.')}{' '}
                  <Link href="/live" className="text-cream underline underline-offset-4">{L('Yayın takvimine bak', 'See live')}</Link>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── category ticker ──────────────────────────────────── */}
        <div className="border-b border-rule py-4 font-display text-2xl text-sage-600">
          <Marquee
            items={['Hatha', 'Vinyasa', 'Yin', 'Restoratif', 'Nefes', 'Meditasyon', 'Yoga Nidra'].map((c) => (
              <Link key={c} href={`/atolyeler?category=${encodeURIComponent(c)}`} className="hover:text-clay-600 italic">
                {c} <span className="text-clay-400 not-italic px-3">✦</span>
              </Link>
            ))}
          />
        </div>

        {/* ── 01 Workshops ─────────────────────────────────────── */}
        <section className="max-w-7xl mx-auto px-6 lg:px-12 pt-24">
          <SectionHead
            num="01"
            label={L('Atölyeler', 'Workshops')}
            title={L('Küçük gruplarla, canlı ya da kayıtlı atölyeler', 'Small-group workshops, live or recorded')}
            href="/atolyeler"
            linkLabel={L('Tüm atölyeler', 'All workshops')}
          />
          {data.workshops.length === 0 ? (
            <p className="text-sage-600">{L('Yeni atölyeler çok yakında burada.', 'New workshops are coming soon.')}</p>
          ) : (
            <Stagger className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
              {data.workshops.map((w) => (
                <StaggerItem key={w.slug}><WorkshopCard w={w} /></StaggerItem>
              ))}
            </Stagger>
          )}
        </section>

        {/* ── 02 One-to-one ────────────────────────────────────── */}
        <section className="max-w-7xl mx-auto px-6 lg:px-12 pt-28">
          <SectionHead
            num="02"
            label={L('Birebir dersler', 'One-to-one lessons')}
            title={L('Size göre bir eğitmen, size göre bir saat', 'A teacher and a time that fit you')}
            href="/teachers"
            linkLabel={L('Eğitmenleri gör', 'Meet the teachers')}
          />
          <Stagger className="grid md:grid-cols-3 gap-10" gap={0.14}>
            {[
              [L('Eğitmeninizi seçin', 'Choose your teacher'), L('Stile, seviyeye ve deneyime göre filtreleyin; tanıtım videosunu izleyin.', 'Filter by style, level and experience; watch the intro video.')],
              [L('Deneme dersi alın', 'Take a trial lesson'), L('İlk dersi yarı fiyatına deneyin. Deneme derslerinden komisyon almıyoruz.', 'Try the first lesson at half price. We take no commission on trial lessons.')],
              [L('Canlı pratik yapın', 'Practise live'), L('Kendi saat diliminizde, görüntülü ve birebir. İsterseniz dersi kaydedip 30 gün boyunca indirin.', 'In your own time zone, face to face. Record the lesson and download it for 30 days.')],
            ].map(([t, d], i) => (
              <StaggerItem key={t} className="border-t border-ink pt-5 lift p-0">
                <span className="font-display text-5xl text-clay-500 leading-none">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="font-display text-2xl mt-4 mb-2">{t}</h3>
                <p className="text-sage-600 leading-relaxed">{d}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        {/* ── 03 Live studio band ──────────────────────────────── */}
        <section className="relative overflow-hidden mt-28 bg-stage text-cream">
          <div className="absolute inset-0 bg-[radial-gradient(60%_80%_at_85%_20%,rgba(201,99,58,0.28),transparent_70%),radial-gradient(50%_70%_at_10%_90%,rgba(233,147,107,0.14),transparent_70%)]" aria-hidden />
          <PhotoBackdrop sources={PHOTOS.studio} opacity={0.35} />
          <div className="absolute inset-0 bg-gradient-to-r from-stage via-stage/90 to-stage/40" aria-hidden />
          <div className="relative max-w-7xl mx-auto px-6 lg:px-12 py-24 grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6">
              <p className="eyebrow !text-cream/50 mb-4"><span className="text-accent">03</span> — {L('Canlı yayın', 'Live broadcast')}</p>
              <h2 className="font-display text-4xl md:text-5xl leading-[1.05]">
                {L('Evinizden bir stüdyoya dönüşen yayın deneyimi', 'A broadcast studio that fits in your living room')}
              </h2>
              <ul className="mt-8 space-y-3 text-cream/80">
                {[
                  L('1080p60’a kadar yayın; izleyici 1080p, 720p veya 360p seçer', 'Up to 1080p60; viewers choose 1080p, 720p or 360p'),
                  L('Canlı sohbet, yavaş mod ve katılımcı yönetimi', 'Live chat, slow mode and moderation'),
                  L('Tek tuşla ders kaydı — yalnızca öğretmen ve öğrenci indirir', 'One-click lesson recording — only teacher and student can download'),
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3"><Check size={18} className="mt-0.5 text-accent shrink-0" /> {t}</li>
                ))}
              </ul>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link href="/live" className="cta inline-flex items-center gap-2 bg-accent hover:bg-accent-dark text-white px-7 py-3.5 text-sm font-semibold rounded-md">{L('Canlı yayınlara bak', 'Watch live')} <ArrowRight size={16} /></Link>
                <Link href="/become-teacher" className="border border-cream/40 hover:bg-white/10 px-7 py-3.5 text-sm font-semibold rounded-md">{L('Yayıncı ol', 'Become a broadcaster')}</Link>
              </div>
            </div>
            <Reveal className="lg:col-span-6" delay={0.1}>
              <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-white/15 bg-[radial-gradient(80%_90%_at_70%_30%,rgba(201,99,58,0.45),rgba(26,24,21,0.95)_70%)] shadow-2xl">
                <PhotoBackdrop sources={PHOTOS.meditation} opacity={0.9} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" aria-hidden />
                <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 bg-accent text-white text-[11px] font-bold tracking-wider uppercase px-2 py-1 rounded"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> {L('Canlı', 'Live')}</span>
                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4 text-sm">
                  <span className="font-display text-xl">{L('Sabah akışı · 1080p60', 'Morning flow · 1080p60')}</span>
                  <span className="flex gap-1.5 text-[11px]">{['1080p', '720p', '360p'].map((q, i) => <span key={q} className={`px-2 py-1 rounded ${i === 0 ? 'bg-white text-ink' : 'bg-white/15'}`}>{q}</span>)}</span>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── 04 Articles ──────────────────────────────────────── */}
        {data.articles.length > 0 && (
          <section className="max-w-7xl mx-auto px-6 lg:px-12 pt-28">
            <SectionHead
              num="04"
              label={L('İçerikler', 'Journal')}
              title={L('Nefes, beden ve zihin üzerine yazılar', 'Writing on breath, body and mind')}
              href="/icerikler"
              linkLabel={L('Tüm yazılar', 'All articles')}
            />
            <Stagger className="grid md:grid-cols-4 gap-x-8 gap-y-12">
              {data.articles.map((a, i) => (
                <StaggerItem key={a.slug} className={i === 0 ? 'md:col-span-2' : ''}><ArticleCard a={a} large={i === 0} /></StaggerItem>
              ))}
            </Stagger>
          </section>
        )}

        {/* ── Teachers ─────────────────────────────────────────── */}
        {data.teachers.length > 0 && (
          <section className="max-w-7xl mx-auto px-6 lg:px-12 pt-28">
            <SectionHead num="05" label={L('Eğitmenler', 'Teachers')} title={L('Pratiğinize eşlik edecek eğitmenler', 'Teachers who will guide your practice')} href="/teachers" linkLabel={L('Tüm eğitmenler', 'All teachers')} />
            <Stagger className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {data.teachers.map((t) => (
                <StaggerItem key={t.id}>
                  <Link href={`/teachers/${t.id}`} className="group block lift">
                    <Cover src={t.image} tone="sage" label={t.name[0]} className="aspect-square mb-4" />
                    <h3 className="font-display text-xl group-hover:underline underline-offset-4 decoration-1">{t.name}</h3>
                    <p className="text-sm text-sage-600 line-clamp-2 mt-1">{t.specialties.slice(0, 3).join(' · ') || t.bio}</p>
                  </Link>
                </StaggerItem>
              ))}
            </Stagger>
          </section>
        )}

        {/* ── Join ─────────────────────────────────────────────── */}
        <section className="relative overflow-hidden mt-28 bg-sage-900 text-cream" data-testid="join-band">
          <div className="absolute inset-0 bg-[radial-gradient(60%_80%_at_85%_20%,rgba(201,99,58,0.28),transparent_70%),radial-gradient(50%_70%_at_10%_90%,rgba(233,147,107,0.14),transparent_70%)]" aria-hidden />
          <PhotoBackdrop sources={PHOTOS.join} opacity={0.4} />
          <div className="absolute inset-0 bg-gradient-to-br from-sage-900 via-sage-900/85 to-sage-900/40" aria-hidden />
          <div className="relative max-w-7xl mx-auto px-6 lg:px-12 py-24 grid lg:grid-cols-12 gap-12 items-center">
            <Reveal className="lg:col-span-6">
              <p className="eyebrow !text-cream/60 mb-4">{L('Aramıza katıl', 'Join us')}</p>
              <h2 className="font-display text-4xl md:text-6xl leading-[1.02]">
                {L('Pratiğin', 'Your practice is')} <em className="italic text-clay-200">{L('bir tık uzağında.', 'one click away.')}</em>
              </h2>
              <p className="mt-6 text-lg text-cream/75 max-w-lg leading-relaxed">
                {L('Üyelik ücretsiz. Kayıt olduktan sonra canlı yayınlara katılır, atölyelere yer ayırır ve ilk deneme dersini yarı fiyatına alırsın.', 'Membership is free. Once you join you can watch live broadcasts, reserve workshop seats and take your first trial lesson at half price.')}
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                {visitor || status === 'loading' ? (
                  <Link href="/login?mode=register" data-testid="join-band-cta" className="cta inline-flex items-center gap-2 bg-accent text-white px-8 py-4 text-base font-semibold hover:bg-accent-dark rounded-md">
                    {L('Ücretsiz üye ol', 'Join for free')} <ArrowRight size={18} />
                  </Link>
                ) : (
                  <Link href="/dashboard" className="cta inline-flex items-center gap-2 bg-accent text-white px-8 py-4 text-base font-semibold hover:bg-accent-dark rounded-md">
                    {L('Panele git', 'Go to dashboard')} <ArrowRight size={18} />
                  </Link>
                )}
                <Link href="/teachers" className="link-grow text-sm font-semibold text-cream">{L('Önce eğitmenlere göz at', 'Meet the teachers first')}</Link>
              </div>
            </Reveal>
            <Stagger className="lg:col-span-6 grid sm:grid-cols-2 gap-4" gap={0.1}>
              {[
                [Radio, L('Canlı yayınlar', 'Live broadcasts'), L('1080p’ye kadar, sohbetli, istediğin kalitede.', 'Up to 1080p with chat, in the quality you choose.')],
                [CalendarCheck, L('Atölyeler', 'Workshops'), L('Küçük gruplarda canlı ya da kayıtlı atölyelere yer ayır.', 'Reserve a seat in small live or recorded workshops.')],
                [Video, L('Birebir dersler', 'One-to-one lessons'), L('Onaylı eğitmenlerle; dersin kaydını 30 gün indir.', 'With vetted teachers; download your lesson for 30 days.')],
                [Sparkles, L('İlerlemeni takip et', 'Track your progress'), L('Seri, puan ve rozetlerle pratiğini sürdür.', 'Keep going with streaks, points and badges.')],
              ].map(([Icon, title, text], i) => {
                const I = Icon as typeof Radio;
                return (
                  <StaggerItem key={i}>
                    <div className="h-full border border-white/15 bg-white/5 backdrop-blur-sm rounded-lg p-5 lift">
                      <I size={22} className="text-clay-200 mb-3" />
                      <h3 className="font-display text-xl">{title as string}</h3>
                      <p className="text-sm text-cream/70 mt-1 leading-relaxed">{text as string}</p>
                    </div>
                  </StaggerItem>
                );
              })}
            </Stagger>
          </div>
        </section>

        {/* ── Teachers CTA ─────────────────────────────────────── */}
        <Reveal>
          <section className="max-w-7xl mx-auto px-6 lg:px-12 py-24">
            <div className="border border-ink p-10 md:p-14 grid md:grid-cols-12 gap-8 items-center">
              <div className="md:col-span-8">
                <p className="eyebrow mb-4">{L('Eğitmenlere çağrı', 'For teachers')}</p>
                <h2 className="font-display text-3xl md:text-4xl leading-[1.08]">{L('Bilginizi paylaşın; atölyenizi ve yayınınızı AYA’da açın.', 'Share what you know; host your workshops and broadcasts on AYA.')}</h2>
              </div>
              <div className="md:col-span-4 md:text-right">
                <Link href="/become-teacher" className="cta inline-flex items-center gap-2 bg-ink text-cream px-7 py-3.5 text-sm font-semibold hover:bg-sage-800 rounded-md">
                  {L('Eğitmen olarak başvur', 'Apply to teach')} <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </section>
        </Reveal>
      </main>
      <Footer />
    </>
  );
}
