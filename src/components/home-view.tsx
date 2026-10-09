'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowRight, Check, Megaphone, Radio, Video, CalendarCheck, Sparkles, Compass, Users } from 'lucide-react';
import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { ArticleCardData, Cover, LiveNowCard, SectionHead, WorkshopCard, WorkshopCardData, useDateFormat, useL } from '@/components/editorial';
import { BreathBreak, PoseOfTheDay } from '@/components/home-extras';
import { NewsletterBand, WaveDivider } from '@/components/section-pages';
import { ARTICLE_CATEGORIES } from '@/lib/articles';
import dynamic from 'next/dynamic';
import { Aurora, Marquee, PhotoBackdrop, Reveal, Stagger, StaggerItem } from '@/components/motion';
import { FaqList } from '@/components/marketing';
import { PoseCard } from '@/components/poses/pose-library';
import { POSE_BY_SLUG, poseImage } from '@/lib/yoga-poses';
import { STYLES, TONE_CLASS } from '@/lib/yoga-styles';

const YogiScene = dynamic(() => import('@/components/three/yogi-scene').then((m) => m.YogiScene), { ssr: false, loading: () => <div className="absolute inset-0" aria-hidden /> });
const HERO_POSES = ['kolay-oturus', 'dag-durusu', 'savasci-2', 'agac', 'ayakta-yukari-uzanis'];
import { PHOTOS } from '@/lib/photos';

export interface HomeData {
  live: { id: string; title: string; viewers: number; teacher: string | null; trial?: boolean } | null;
  workshops: WorkshopCardData[];
  articles: ArticleCardData[];
  news: ArticleCardData[];
  teachers: { id: string; name: string; image: string | null; bio: string | null; specialties: string[] }[];
}

export default function HomeView({ data }: { data: HomeData }) {
  const L = useL();
  const f = useDateFormat();
  const { status } = useSession();
  const visitor = status === 'unauthenticated';
  const [heroPose, setHeroPose] = useState(HERO_POSES[0]);

  return (
    <>
      <Navbar />
      <main>
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-clay-50 via-cream to-teal-100" aria-hidden />
          <PhotoBackdrop sources={PHOTOS.hero} opacity={0.12} />
          <Aurora />
          <div className="relative max-w-7xl mx-auto px-6 lg:px-12 pt-12 pb-14 lg:pt-16 lg:pb-20 grid lg:grid-cols-12 gap-6 lg:gap-10 items-center">
            <div className="lg:col-span-6">
              <p className="eyebrow mb-6 animate-fade-up" style={{ animationDelay: '0.05s', opacity: 0 }}>{L('Yoga · Nefes · Meditasyon', 'Yoga · Breath · Meditation')}</p>
              <h1 className="font-display font-light text-[3.1rem] sm:text-7xl lg:text-[5.2rem] leading-[0.98] tracking-tight animate-fade-up" style={{ animationDelay: '0.15s', opacity: 0 }}>
                {L('Nefes, beden ve zihin için', 'A live school for breath,')}{' '}
                <em className="italic text-gradient pr-1">{L('canlı bir okul.', 'body and mind.')}</em>
              </h1>
              <p className="mt-7 text-lg text-sage-600 max-w-xl leading-relaxed animate-fade-up" style={{ animationDelay: '0.3s', opacity: 0 }}>
                {L(
                  'Sertifikalı eğitmenlerle birebir dersler, herkese açık canlı yayınlar ve küçük gruplarla atölyeler. Evinizden, kendi temponuzla.',
                  'One-to-one lessons with certified teachers, open live broadcasts and small-group workshops. From home, at your own pace.'
                )}
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4 animate-fade-up" style={{ animationDelay: '0.45s', opacity: 0 }}>
                {visitor ? (
                  <Link href="/login?mode=register" data-testid="hero-join" className="btn-cta pulse-cta text-base">
                    {L('Ücretsiz üye ol', 'Join for free')} <ArrowRight size={18} />
                  </Link>
                ) : (
                  <Link href="/atolyeler" className="btn-cta text-base">
                    {L('Atölyelere göz at', 'Browse workshops')} <ArrowRight size={18} />
                  </Link>
                )}
                {visitor ? (
                  <Link href="/nasil-calisir" className="btn-ghost text-base">{L('Nasıl çalışır?', 'How it works')}</Link>
                ) : (
                  <Link href="/teachers" className="btn-ghost text-base">{L('Eğitmen bul', 'Find a teacher')}</Link>
                )}
              </div>
              <ul className="mt-9 flex flex-wrap gap-x-7 gap-y-2 text-sm text-sage-700 animate-fade-up" style={{ animationDelay: '0.6s', opacity: 0 }}>
                {[L('İlk deneme dersi yarı fiyat', 'First trial lesson half price'), L('Canlı yayın ve sohbet', 'Live streams and chat'), L('Dersin kaydı 30 gün indirilebilir', 'Lesson recordings for 30 days')].map((t) => (
                  <li key={t} className="flex items-center gap-2"><Check size={15} className="text-teal-500" /> {t}</li>
                ))}
              </ul>
            </div>
            <div className="lg:col-span-6">
              <div className="relative h-[420px] sm:h-[520px] lg:h-[600px]">
                <YogiScene poses={HERO_POSES} className="absolute inset-0" label={setHeroPose} />
                <Link href={`/pozlar/${heroPose}`} data-testid="hero-pose-chip" className="absolute left-1/2 -translate-x-1/2 bottom-2 inline-flex items-center gap-2 bg-paper/90 backdrop-blur border border-rule shadow-md rounded-full pl-4 pr-3 py-2 min-h-[44px] text-sm font-medium hover:border-ink transition">
                  <span className="w-2 h-2 rounded-full bg-clay-500 animate-pulse" aria-hidden /> {POSE_BY_SLUG[heroPose]?.name} <span className="text-sage-500 italic hidden sm:inline">{POSE_BY_SLUG[heroPose]?.sanskrit}</span> <ArrowRight size={14} />
                </Link>
              </div>
              {data.live ? (
                <LiveNowCard id={data.live.id} title={data.live.title} teacher={data.live.teacher} viewers={data.live.viewers} trial={data.live.trial} />
              ) : (
                <div className="mt-3 bg-teal-900 text-cream/80 px-5 py-4 text-sm rounded-2xl">
                  {L('Şu anda canlı yayın yok.', 'Nobody is live right now.')}{' '}
                  <Link href="/live" className="tap-area text-cream underline underline-offset-4">{L('Yayın takvimine bak', 'See live')}</Link>
                </div>
              )}
            </div>
          </div>
          <WaveDivider className="relative text-cream" />
        </section>

        {/* ── Yazılar + Duyurular / Haberler (from the sketch) ─────── */}
        <section className="max-w-7xl mx-auto px-6 lg:px-12 pt-10" data-testid="home-feed">
          <div className="grid lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 rounded-3xl border border-rule bg-white p-6 md:p-9 shadow-md" data-testid="home-articles">
              <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-rule">
                <h2 className="font-display text-4xl md:text-5xl">{L('Yazılar', 'Articles')}</h2>
                <Link href="/icerikler" className="tap-area group inline-flex items-center gap-2 text-sm font-semibold text-teal-700">{L('Tüm yazılar', 'All articles')} <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" /></Link>
              </div>
              <div className="flex flex-wrap gap-2 mt-5">
                {ARTICLE_CATEGORIES.map((c) => (
                  <Link key={c} href={`/icerikler?category=${encodeURIComponent(c)}`} className="tap-area px-3.5 py-1.5 text-xs font-semibold rounded-full bg-teal-50 text-teal-700 hover:bg-teal-700 hover:text-white transition-colors">{c}</Link>
                ))}
              </div>
              {data.articles.length === 0 ? (
                <p className="mt-8 text-sage-600 py-10 text-center border border-dashed border-rule rounded-2xl">{L('Yakında burada yeni yazılar olacak.', 'New articles will appear here soon.')}</p>
              ) : (
                <div className="mt-6 grid md:grid-cols-2 gap-6">
                  <Link href={`/icerikler/${data.articles[0].slug}`} data-testid="article-card" className="group block">
                    <Cover src={data.articles[0].coverUrl} tone="clay" label={data.articles[0].title[0]} className="aspect-[4/3] mb-4 rounded-2xl" />
                    <p className="eyebrow mb-1.5">{data.articles[0].category}</p>
                    <h3 className="font-display text-2xl leading-snug group-hover:underline underline-offset-4 decoration-1">{data.articles[0].title}</h3>
                    <p className="text-sm text-sage-600 mt-2 line-clamp-2">{data.articles[0].excerpt}</p>
                  </Link>
                  <ul className="divide-y divide-rule">
                    {data.articles.slice(1).map((a) => (
                      <li key={a.slug}>
                        <Link href={`/icerikler/${a.slug}`} data-testid="article-card" className="group block py-4 first:pt-0">
                          <p className="eyebrow mb-1">{a.category}{a.publishedAt ? <span className="normal-case tracking-normal font-normal text-sage-500"> · {f.dateShort(a.publishedAt)}</span> : null}</p>
                          <h3 className="font-display text-xl leading-snug group-hover:text-teal-700 transition-colors">{a.title}</h3>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="lg:col-span-5 relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-800 via-teal-700 to-teal-600 text-white p-6 md:p-9 shadow-lg" data-testid="home-news">
              <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-sky-300/20 blur-3xl" aria-hidden />
              <div className="relative">
                <div className="flex items-end justify-between gap-4 pb-5 border-b border-white/20">
                  <h2 className="font-display text-4xl md:text-5xl leading-[1.05]">{L('Duyurular', 'Announcements')}<br />{L('Haberler', '& News')}</h2>
                  <Link href="/duyurular" className="tap-area text-sm font-semibold text-white/85 hover:text-white inline-flex items-center gap-1.5 shrink-0">{L('Tümü', 'All')} <ArrowRight size={14} /></Link>
                </div>
                {data.news.length === 0 ? (
                  <div className="mt-10 flex flex-col items-center text-center gap-4 py-10">
                    <span className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center"><Megaphone size={26} className="text-sky-200" /></span>
                    <p className="text-white/75 max-w-xs">{L('Şimdilik yeni bir duyuru yok. Gelişmeleri aşağıdaki bültenle takip edebilirsiniz.', 'No announcements for now. Follow updates with the newsletter below.')}</p>
                  </div>
                ) : (
                  <ul className="mt-2">
                    {data.news.map((n) => (
                      <li key={n.slug} className="border-b border-white/15 last:border-0">
                        <Link href={`/icerikler/${n.slug}`} className="group flex items-start gap-4 py-4">
                          <span className="shrink-0 mt-1 text-[10px] font-bold tracking-wider uppercase bg-white/15 rounded-full px-2.5 py-1">{n.category}</span>
                          <span className="min-w-0">
                            <span className="block font-display text-xl leading-snug group-hover:underline underline-offset-4 decoration-1">{n.title}</span>
                            {n.publishedAt && <span className="block text-xs text-white/60 mt-1">{f.date(n.publishedAt)}</span>}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-6 mt-6">
            <div className="lg:col-span-5"><PoseOfTheDay /></div>
            <div className="lg:col-span-7"><BreathBreak /></div>
          </div>
        </section>

        {/* ── category ticker ──────────────────────────────────── */}
        <div className="border-y border-rule py-4 mt-16 font-display text-2xl text-sage-600">
          <Marquee
            items={['Hatha', 'Vinyasa', 'Yin', 'Restoratif', 'Nefes', 'Meditasyon', 'Yoga Nidra'].map((c) => (
              <Link key={c} href={`/atolyeler?category=${encodeURIComponent(c)}`} className="tap-area hover:text-clay-600 italic">
                {c} <span className="text-clay-400 not-italic px-3">✦</span>
              </Link>
            ))}
          />
        </div>

        {/* ── Styles ───────────────────────────────────────────── */}
        <section className="max-w-7xl mx-auto px-6 lg:px-12 pt-24" data-testid="home-styles">
          <SectionHead num="01" label={L('Yoga stilleri', 'Yoga styles')} title={L('Sana hangi yoga uygun?', 'Which yoga is right for you?')} href="/yoga-stilleri" linkLabel={L('Tüm stiller', 'All styles')} />
          <Stagger className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {STYLES.map((st) => (
              <StaggerItem key={st.slug}>
                <Link href={`/yoga-stilleri/${st.slug}`} className="group relative block rounded-3xl overflow-hidden card-lift border border-rule">
                  <div className={`aspect-[5/4] bg-gradient-to-br ${TONE_CLASS[st.tone]} relative`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={poseImage(st.cover)} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/75 via-black/40 to-transparent" aria-hidden />
                    <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                      <h3 className="font-display text-4xl">{st.name}</h3>
                      <p className="text-sm text-white/85 mt-1 line-clamp-2">{st.tagline}</p>
                    </div>
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        {/* ── Pose library teaser ──────────────────────────────── */}
        <section className="mt-24 surface-mint border-y border-rule" data-testid="home-poses">
          <div className="max-w-7xl mx-auto px-6 lg:px-12 py-20">
            <SectionHead num="02" label={L('Poz kütüphanesi', 'Pose library')} title={L('Her pozu adım adım, 3B olarak öğren', 'Learn every pose step by step, in 3D')} href="/pozlar" linkLabel={L('Tüm pozlar', 'All poses')} />
            <Stagger className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {['savasci-2', 'agac', 'asagi-bakan-kopek', 'kolay-oturus'].map((slug) => (
                <StaggerItem key={slug}><PoseCard slug={slug} /></StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>

        {/* ── 01 Workshops ─────────────────────────────────────── */}
        <section className="max-w-7xl mx-auto px-6 lg:px-12 pt-24">
          <SectionHead
            num="03"
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
            num="04"
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
          <div className="absolute inset-0 bg-[radial-gradient(60%_80%_at_85%_20%,rgba(47,125,225,0.28),transparent_70%),radial-gradient(50%_70%_at_10%_90%,rgba(91,156,240,0.14),transparent_70%)]" aria-hidden />
          <PhotoBackdrop sources={PHOTOS.studio} opacity={0.35} />
          <div className="absolute inset-0 bg-gradient-to-r from-stage via-stage/90 to-stage/40" aria-hidden />
          <div className="relative max-w-7xl mx-auto px-6 lg:px-12 py-24 grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6">
              <p className="eyebrow !text-cream/50 mb-4"><span className="text-accent">05</span> — {L('Canlı yayın', 'Live broadcast')}</p>
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
              <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-white/15 bg-[radial-gradient(80%_90%_at_70%_30%,rgba(47,125,225,0.45),rgba(26,24,21,0.95)_70%)] shadow-2xl">
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

        {/* ── Teachers ─────────────────────────────────────────── */}
        {data.teachers.length > 0 && (
          <section className="max-w-7xl mx-auto px-6 lg:px-12 pt-28">
            <SectionHead num="07" label={L('Eğitmenler', 'Teachers')} title={L('Pratiğinize eşlik edecek eğitmenler', 'Teachers who will guide your practice')} href="/teachers" linkLabel={L('Tüm eğitmenler', 'All teachers')} />
            <Stagger className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {data.teachers.map((t) => (
                <StaggerItem key={t.id}>
                  <Link href={`/teachers/${t.id}`} className="group block lift">
                    <Cover src={t.image} tone="sage" label={t.name[0]} person={t.name} className="aspect-square mb-4" />
                    <h3 className="font-display text-xl group-hover:underline underline-offset-4 decoration-1">{t.name}</h3>
                    <p className="text-sm text-sage-600 line-clamp-2 mt-1">{t.specialties.slice(0, 3).join(' · ') || t.bio}</p>
                  </Link>
                </StaggerItem>
              ))}
            </Stagger>
          </section>
        )}

        {/* ── FAQ teaser ───────────────────────────────────────── */}
        <section className="max-w-7xl mx-auto px-6 lg:px-12 pt-28" data-testid="home-faq">
          <SectionHead num="08" label={L('Sık sorulanlar', 'FAQ')} title={L('Aklına takılanlar', 'Questions you might have')} href="/sss" linkLabel={L('Tüm sorular', 'All questions')} />
          <FaqList
            items={[
              { q: L('AYA ücretsiz mi?', 'Is AYA free?'), a: L('Üyelik ve canlı yayınları izlemek ücretsiz. Birebir ders ve atölyeler eğitmenin belirlediği ücretle yapılır; ilk deneme dersi yarı fiyatına.', 'Membership and watching broadcasts are free. One-to-one lessons and workshops are priced by the teacher; your first trial lesson is half price.') },
              { q: L('Hiç yoga yapmadıysam?', 'What if I have never done yoga?'), a: L('Sorun değil. “Yoga stilleri” ve “Poz kütüphanesi” sayfalarından başla; eğitmenlerin seviye etiketlerine göre başlangıç dostu dersleri seç.', 'No problem. Start with the yoga styles and pose library pages, then choose beginner-friendly lessons using the teachers’ level tags.') },
              { q: L('Eğitmenler nasıl seçiliyor?', 'How are teachers vetted?'), a: L('Her eğitmen başvuru ve kimlik/sertifika incelemesinden geçer. Eğitmenlerin platform dışına yönlendirme yapması yasaktır ve otomatik denetlenir.', 'Every teacher goes through an application and credential review. Steering students off the platform is forbidden and monitored automatically.') },
              { q: L('Dersler kaydediliyor mu?', 'Are lessons recorded?'), a: L('İstersen birebir dersi kaydedip 30 gün boyunca indirebilirsin.', 'If you like, you can record a one-to-one lesson and download it for 30 days.') },
            ]}
          />
        </section>

        {/* ── Join ─────────────────────────────────────────────── */}
        <section className="relative overflow-hidden mt-28 bg-sage-900 text-cream" data-testid="join-band">
          <div className="absolute inset-0 bg-[radial-gradient(60%_80%_at_85%_20%,rgba(47,125,225,0.28),transparent_70%),radial-gradient(50%_70%_at_10%_90%,rgba(91,156,240,0.14),transparent_70%)]" aria-hidden />
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
                  <Link href="/login?mode=register" data-testid="join-band-cta" className="btn-cta !px-8 !py-4 !text-base">
                    {L('Ücretsiz üye ol', 'Join for free')} <ArrowRight size={18} />
                  </Link>
                ) : (
                  <Link href="/panel" className="btn-cta !px-8 !py-4 !text-base">
                    {L('Panele git', 'Go to dashboard')} <ArrowRight size={18} />
                  </Link>
                )}
                <Link href="/teachers" className="tap-area link-grow text-sm font-semibold text-cream">{L('Önce eğitmenlere göz at', 'Meet the teachers first')}</Link>
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
                <Link href="/become-teacher" className="btn-deep">
                  {L('Eğitmen olarak başvur', 'Apply to teach')} <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </section>
        </Reveal>
        <NewsletterBand />
      </main>
      <Footer />
    </>
  );
}
