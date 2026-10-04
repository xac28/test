'use client';

import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import LanguagePicker from '@/components/LanguagePicker';
import BookingWidget from '@/components/BookingWidget';
import { useI18n } from '@/i18n';
import { useTeacher } from '@/lib/use-teacher';
import { Cover } from '@/components/editorial';
import { styleLabel } from '@/lib/constants';
import { TeacherRecordedVideos } from '@/components/teacher-recorded-videos';
import { MessageTeacherButton } from '@/components/message-teacher-button';
import { ReportButton } from '@/components/report-dialog';

export default function TeacherProfilePage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const { teacher, loading } = useTeacher(slug);
  const { t, locale } = useI18n();

  if (!teacher) {
    return (
      <>
        <Navbar />
        <main className="max-w-3xl mx-auto px-6 py-32 text-center">
          {loading ? (
            <p className="text-sage-500">{locale === 'tr' ? 'Yükleniyor…' : 'Loading…'}</p>
          ) : (
            <>
              <h1 className="font-display text-4xl mb-3">{locale === 'tr' ? 'Eğitmen bulunamadı' : 'Teacher not found'}</h1>
              <p className="text-sage-600 mb-6">{locale === 'tr' ? 'Bu profil yok ya da henüz onaylanmadı.' : 'This profile does not exist or is not approved yet.'}</p>
              <Link href="/teachers" className="underline underline-offset-4 font-semibold">{locale === 'tr' ? 'Tüm eğitmenler' : 'All teachers'}</Link>
            </>
          )}
        </main>
        <Footer />
      </>
    );
  }
  const isUpload = teacher.avatar.startsWith('/uploads/') || !teacher.avatar;

  return (
    <>
      <LanguagePicker />
      <Navbar />

      <section className="bg-gradient-to-b from-cream to-sage-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-8">
          <Link href="/teachers" className="text-sm text-ink/60 hover:text-sage-700 inline-flex items-center gap-1.5">
            <span>←</span> {t.common.back}
          </Link>
        </div>
      </section>

      <section className="bg-sage-50 pb-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* LEFT: profile content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Profile header */}
              <div className="bg-cream rounded-3xl p-6 lg:p-8 border border-sage-100">
                <div className="flex flex-col sm:flex-row gap-6">
                  <div className="relative w-32 h-32 rounded-3xl overflow-hidden flex-shrink-0">
                    {isUpload ? <Cover src={teacher.avatar || null} alt={teacher.name} label={teacher.name[0]} className="absolute inset-0 [&_span]:text-5xl" /> : <Image src={teacher.avatar} alt={teacher.name} fill sizes="128px" className="object-cover" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 text-sm text-ink/60">
                      <span>{teacher.countryFlag}</span>
                      <span>{teacher.country}</span>
                    </div>
                    <h1 className="font-display text-3xl md:text-4xl text-ink mb-2">{teacher.name}</h1>
                    <p className="text-ink/70 mb-3">{teacher.bio[locale]}</p>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <span className="text-yellow-600">★</span>
                        <span className="font-medium">{teacher.rating}</span>
                        <span className="text-ink/50">({teacher.reviewCount})</span>
                      </div>
                      <div className="text-ink/60">
                        {teacher.yearsExperience} {t.card.yearsExp}
                      </div>
                      <div className="text-ink/60">
                        {teacher.studentsCount} students
                      </div>
                    </div>
                    <div className="mt-4 flex items-center flex-wrap">
                      <MessageTeacherButton teacherId={slug} />
                      <ReportButton targetType="TEACHER" targetId={slug} subject={teacher.name} label="Bildir" className="ml-4 inline-flex items-center gap-1.5 text-sm text-ink/50 hover:text-red-600" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Video intro */}
              <div className="bg-cream rounded-3xl p-6 lg:p-8 border border-sage-100">
                <h2 className="font-display text-2xl text-ink mb-4">{t.profile.intro}</h2>
                <div className="aspect-video rounded-2xl bg-gradient-to-br from-sage-700 via-sage-600 to-clay-500 relative overflow-hidden flex items-center justify-center group cursor-pointer">
                  {/* Faux video poster */}
                  {!isUpload && (
                    <Image
                      src={teacher.avatar}
                      alt=""
                      fill
                      sizes="(max-width: 1024px) 100vw, 66vw"
                      className="object-cover opacity-40 group-hover:opacity-30 transition-opacity"
                    />
                  )}
                  <div className="relative z-10 text-center">
                    <div className="w-20 h-20 rounded-full bg-cream/95 flex items-center justify-center mb-3 mx-auto group-hover:scale-110 transition-transform shadow-2xl">
                      <svg className="w-7 h-7 text-sage-700 ml-1" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                    <p className="text-cream/90 font-display italic text-lg">60-second introduction</p>
                  </div>
                  <div className="absolute bottom-4 right-4 bg-ink/60 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-cream">
                    0:58
                  </div>
                </div>
              </div>

              {/* About */}
              <div className="bg-cream rounded-3xl p-6 lg:p-8 border border-sage-100">
                <h2 className="font-display text-2xl text-ink mb-4">{t.profile.about}</h2>
                <p className="text-ink/80 leading-relaxed whitespace-pre-line">
                  {teacher.longBio[locale]}
                </p>
              </div>

              {/* Recorded Sessions Component */}
              <TeacherRecordedVideos teacherId={slug} />

              {/* Details grid */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="bg-cream rounded-3xl p-5 border border-sage-100">
                  <h3 className="text-xs uppercase tracking-wide text-ink/50 mb-3">{t.profile.teaches}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {teacher.styles.map((s) => (
                      <span key={s} className="text-xs px-2.5 py-1 rounded-full bg-sage-100 text-sage-800">
                        {styleLabel(s, locale)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-cream rounded-3xl p-5 border border-sage-100">
                  <h3 className="text-xs uppercase tracking-wide text-ink/50 mb-3">{t.profile.speaks}</h3>
                  <div className="space-y-1">
                    {teacher.languages.map((l) => (
                      <div key={l} className="text-sm text-ink/80">{l}</div>
                    ))}
                  </div>
                </div>

                <div className="bg-cream rounded-3xl p-5 border border-sage-100">
                  <h3 className="text-xs uppercase tracking-wide text-ink/50 mb-3">{t.profile.certifications}</h3>
                  <div className="space-y-1">
                    {teacher.certifications.map((c) => (
                      <div key={c} className="text-sm text-ink/80">· {c}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: sticky booking widget */}
            <div>
              <div className="lg:sticky lg:top-24">
                <BookingWidget teacher={teacher} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
