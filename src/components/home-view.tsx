'use client';

import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { ArticleCard, ArticleCardData, Cover, LiveNowCard, SectionHead, WorkshopCard, WorkshopCardData, useL } from '@/components/editorial';

export interface HomeData {
  live: { id: string; title: string; viewers: number; teacher: string | null } | null;
  workshops: WorkshopCardData[];
  articles: ArticleCardData[];
  teachers: { id: string; name: string; image: string | null; bio: string | null; specialties: string[] }[];
}

const HERO_IMG = 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=1600&auto=format&fit=crop';
const MEDITATION_IMG = 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=1400&auto=format&fit=crop';

export default function HomeView({ data }: { data: HomeData }) {
  const L = useL();

  return (
    <>
      <Navbar />
      <main>
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="border-b border-rule">
          <div className="max-w-7xl mx-auto px-6 lg:px-12 pt-16 pb-14 lg:pt-24 lg:pb-20 grid lg:grid-cols-12 gap-10 lg:gap-14 items-end">
            <div className="lg:col-span-7">
              <p className="eyebrow mb-6">{L('Yoga · Nefes · Meditasyon', 'Yoga · Breath · Meditation')}</p>
              <h1 className="font-display font-light text-[3.1rem] sm:text-7xl lg:text-[5.6rem] leading-[0.98] tracking-tight">
                {L('Nefes, beden ve zihin için', 'A live school for breath,')}{' '}
                <em className="italic text-clay-500">{L('canlı bir okul.', 'body and mind.')}</em>
              </h1>
              <p className="mt-8 text-lg text-sage-600 max-w-xl leading-relaxed">
                {L(
                  'Sertifikalı eğitmenlerle birebir dersler, herkese açık canlı yayınlar ve küçük gruplarla atölyeler. Evinizden, kendi temponuzla.',
                  'One-to-one lessons with certified teachers, open live broadcasts and small-group workshops. From home, at your own pace.'
                )}
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link href="/atolyeler" className="inline-flex items-center gap-2 bg-ink text-cream px-7 py-3.5 text-sm font-semibold hover:bg-sage-800 transition-colors rounded-md">
                  {L('Atölyelere göz at', 'Browse workshops')} <ArrowRight size={16} />
                </Link>
                <Link href="/teachers" className="inline-flex items-center gap-2 px-1 py-3.5 text-sm font-semibold underline underline-offset-[6px] decoration-1 hover:text-clay-600">
                  {L('Eğitmen bul', 'Find a teacher')}
                </Link>
              </div>
            </div>
            <div className="lg:col-span-5">
              <Cover src={HERO_IMG} alt="" label="A" className="aspect-[4/5] w-full" />
              {data.live ? (
                <LiveNowCard id={data.live.id} title={data.live.title} teacher={data.live.teacher} viewers={data.live.viewers} />
              ) : (
                <div className="bg-sage-900 text-cream/70 px-5 py-4 text-sm">
                  {L('Şu anda canlı yayın yok.', 'Nobody is live right now.')}{' '}
                  <Link href="/live" className="text-cream underline underline-offset-4">{L('Yayın takvimine bak', 'See live')}</Link>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── category strip ───────────────────────────────────── */}
        <div className="border-b border-rule overflow-hidden">
          <ul className="max-w-7xl mx-auto px-6 lg:px-12 py-4 flex flex-wrap gap-x-8 gap-y-2 font-display text-xl text-sage-600">
            {['Hatha', 'Vinyasa', 'Yin', 'Restoratif', 'Nefes', 'Meditasyon', 'Yoga Nidra'].map((c) => (
              <li key={c}>
                <Link href={`/atolyeler?category=${encodeURIComponent(c)}`} className="hover:text-clay-600 italic">{c}</Link>
              </li>
            ))}
          </ul>
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
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
              {data.workshops.map((w) => (
                <WorkshopCard key={w.slug} w={w} />
              ))}
            </div>
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
          <ol className="grid md:grid-cols-3 gap-10">
            {[
              [L('Eğitmeninizi seçin', 'Choose your teacher'), L('Stile, seviyeye ve deneyime göre filtreleyin; tanıtım videosunu izleyin.', 'Filter by style, level and experience; watch the intro video.')],
              [L('Deneme dersi alın', 'Take a trial lesson'), L('İlk dersi yarı fiyatına deneyin. Deneme derslerinden komisyon almıyoruz.', 'Try the first lesson at half price. We take no commission on trial lessons.')],
              [L('Canlı pratik yapın', 'Practise live'), L('Kendi saat diliminizde, görüntülü ve birebir. İsterseniz dersi kaydedip 30 gün boyunca indirin.', 'In your own time zone, face to face. Record the lesson and download it for 30 days.')],
            ].map(([t, d], i) => (
              <li key={t} className="border-t border-ink pt-5">
                <span className="font-display text-5xl text-clay-500 leading-none">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="font-display text-2xl mt-4 mb-2">{t}</h3>
                <p className="text-sage-600 leading-relaxed">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── 03 Live studio band ──────────────────────────────── */}
        <section className="mt-28 bg-stage text-cream">
          <div className="max-w-7xl mx-auto px-6 lg:px-12 py-20 grid lg:grid-cols-12 gap-12 items-center">
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
                <Link href="/live" className="bg-accent hover:bg-accent-dark text-white px-7 py-3.5 text-sm font-semibold rounded-md">{L('Canlı yayınlara bak', 'Watch live')}</Link>
                <Link href="/become-teacher" className="border border-cream/40 hover:bg-white/10 px-7 py-3.5 text-sm font-semibold rounded-md">{L('Yayıncı ol', 'Become a broadcaster')}</Link>
              </div>
            </div>
            <div className="lg:col-span-6">
              <Cover src={MEDITATION_IMG} tone="ink" label="◐" className="aspect-video w-full" />
            </div>
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
            <div className="grid md:grid-cols-4 gap-x-8 gap-y-12">
              {data.articles.map((a, i) => (
                <ArticleCard key={a.slug} a={a} large={i === 0} />
              ))}
            </div>
          </section>
        )}

        {/* ── Teachers ─────────────────────────────────────────── */}
        {data.teachers.length > 0 && (
          <section className="max-w-7xl mx-auto px-6 lg:px-12 pt-28">
            <SectionHead num="05" label={L('Eğitmenler', 'Teachers')} title={L('Pratiğinize eşlik edecek eğitmenler', 'Teachers who will guide your practice')} href="/teachers" linkLabel={L('Tüm eğitmenler', 'All teachers')} />
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {data.teachers.map((t) => (
                <Link key={t.id} href={`/teachers/${t.id}`} className="group block">
                  <Cover src={t.image} tone="sage" label={t.name[0]} className="aspect-square mb-4" />
                  <h3 className="font-display text-xl group-hover:underline underline-offset-4 decoration-1">{t.name}</h3>
                  <p className="text-sm text-sage-600 line-clamp-2 mt-1">{t.specialties.slice(0, 3).join(' · ') || t.bio}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── CTA ──────────────────────────────────────────────── */}
        <section className="max-w-7xl mx-auto px-6 lg:px-12 pt-28">
          <div className="border border-ink p-10 md:p-16 grid md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-8">
              <p className="eyebrow mb-4">{L('Eğitmenlere çağrı', 'For teachers')}</p>
              <h2 className="font-display text-4xl md:text-5xl leading-[1.05]">{L('Bilginizi paylaşın; atölyenizi ve yayınınızı AYA’da açın.', 'Share what you know; host your workshops and broadcasts on AYA.')}</h2>
            </div>
            <div className="md:col-span-4 md:text-right">
              <Link href="/become-teacher" className="inline-flex items-center gap-2 bg-ink text-cream px-7 py-3.5 text-sm font-semibold hover:bg-sage-800 rounded-md">
                {L('Eğitmen olarak başvur', 'Apply to teach')} <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
