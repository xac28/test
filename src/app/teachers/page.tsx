'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import LanguagePicker from '@/components/LanguagePicker';
import TeacherCard from '@/components/TeacherCard';
import { useI18n } from '@/i18n';
import { TEACHERS } from '@/lib/teachers';
import {
  YOGA_STYLES,
  YogaStyle,
  Level,
  ExperienceBucket,
  experienceBucket,
} from '@/lib/constants';

type Filters = {
  style: YogaStyle | null;
  level: Level | null;
  exp: ExperienceBucket | null;
};

interface DbTeacher {
  id: string;
  slug: string;
  name: string;
  avatar: string;
  country: string;
  bio: string;
  specialties: string[];
  hourlyRate: number;
  studentsCount: number;
  rating: number;
  reviewCount: number;
  isDbTeacher: boolean;
}

const PAGE_SIZE = 24;

export default function TeachersPage() {
  const { t, locale } = useI18n();
  const [filters, setFilters] = useState<Filters>({ style: null, level: null, exp: null });
  const [visible, setVisible] = useState(PAGE_SIZE); // long lists are shown a page at a time
  useEffect(() => setVisible(PAGE_SIZE), [filters]);
  const [dbTeachers, setDbTeachers] = useState<DbTeacher[]>([]);

  // Fetch real teachers from DB
  useEffect(() => {
    fetch('/api/teachers')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setDbTeachers(data); })
      .catch(() => {});
  }, []);

  // Merge DB teachers into the static list format
  const allTeachers = useMemo(() => {
    const dbAsStatic = dbTeachers.map(dt => ({
      ...TEACHERS[0], // base structure
      id: dt.id,
      slug: dt.slug,
      name: dt.name,
      country: dt.country,
      countryFlag: '🌍',
      avatar: dt.avatar,
      bio: { en: dt.bio, tr: dt.bio },
      longBio: { en: dt.bio, tr: dt.bio },
      styles: dt.specialties.map((s: string) => {
        const map: Record<string, YogaStyle> = {
          'face yoga': 'hatha',
          'yin yoga': 'yin',
          'fasyal yoga': 'hatha',
          'vinyasa': 'vinyasa',
          'hatha yoga': 'hatha',
          'mindfulness & meditation': 'meditation',
        };
        return map[s.toLowerCase()] || 'hatha';
      }) as YogaStyle[],
      levels: ['beginner', 'intermediate'] as Level[],
      yearsExperience: 1,
      languages: ['English'],
      certifications: ['Certified'],
      rating: dt.rating,
      reviewCount: dt.reviewCount,
      studentsCount: dt.studentsCount,
      pricePerClassUSD: dt.hourlyRate,
      trialPriceUSD: Math.round(dt.hourlyRate * 0.5),
      videoIntroUrl: '',
      availability: TEACHERS[0].availability,
      _isDbTeacher: true,
    }));

    // DB teachers first, then static demo teachers
    return [...dbAsStatic, ...TEACHERS];
  }, [dbTeachers]);

  const filtered = useMemo(() => {
    return allTeachers.filter((teacher) => {
      if (filters.style && !teacher.styles.includes(filters.style)) return false;
      if (filters.level && !teacher.levels.includes(filters.level)) return false;
      if (filters.exp && experienceBucket(teacher.yearsExperience) !== filters.exp) return false;
      return true;
    });
  }, [filters, allTeachers]);

  const hasActiveFilters = filters.style || filters.level || filters.exp;

  return (
    <>
      <LanguagePicker />
      <Navbar />

      <section className="border-b border-rule">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 pt-16 pb-12">
          <p className="eyebrow mb-4">{locale === 'tr' ? 'Eğitmenler' : 'Teachers'}</p>
          <h1 className="font-display font-light text-5xl md:text-7xl leading-[1.0] max-w-4xl">
            {locale === 'tr' ? 'Size uygun' : 'Find the'} <em className="italic text-clay-500">{locale === 'tr' ? 'eğitmeni bulun.' : 'right guide.'}</em>
          </h1>
          <p className="mt-6 text-lg text-sage-600" data-testid="teacher-count">
            {filtered.length} {t.filters.results}
          </p>
        </div>
      </section>

      <section className="sticky top-16 z-40 bg-cream border-b border-rule py-4">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex flex-wrap items-center gap-4 md:gap-8">
            {([
              [t.filters.style, filters.style ?? '', (v: string) => setFilters({ ...filters, style: (v || null) as YogaStyle | null }),
                [['', locale === 'tr' ? 'Tüm stiller' : 'All styles'], ...YOGA_STYLES.map((s) => [s.id, s[locale]] as [string, string])]],
              [t.filters.level, filters.level ?? '', (v: string) => setFilters({ ...filters, level: (v || null) as Level | null }),
                [['', locale === 'tr' ? 'Tüm seviyeler' : 'All levels'], ['beginner', t.filters.levels.beginner], ['intermediate', t.filters.levels.intermediate], ['advanced', t.filters.levels.advanced]]],
              [t.filters.experience, filters.exp ?? '', (v: string) => setFilters({ ...filters, exp: (v || null) as ExperienceBucket | null }),
                [['', locale === 'tr' ? 'Her deneyim' : 'Any experience'], ['lt2', t.filters.experiences.lt2], ['2to5', t.filters.experiences['2to5']], ['5to10', t.filters.experiences['5to10']], ['10plus', t.filters.experiences['10plus']]]],
            ] as [string, string, (v: string) => void, [string, string][]][]).map(([label, value, onChange, options]) => (
              <label key={label} className="flex items-center gap-3">
                <span className="eyebrow hidden md:block">{label}</span>
                <select
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  className="bg-paper border border-rule hover:border-ink rounded-md px-3 py-2 text-sm font-medium focus:outline-none cursor-pointer"
                >
                  {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
            ))}

            {hasActiveFilters && (
              <button
                onClick={() => setFilters({ style: null, level: null, exp: null })}
                className="ml-auto text-sm font-semibold underline underline-offset-4 hover:text-clay-600"
              >
                {t.filters.clear}
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="py-14 min-h-[60vh]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          {filtered.length === 0 ? (
            <div className="border border-dashed border-rule py-24 text-center">
              <p className="font-display text-3xl">{locale === 'tr' ? 'Filtrelerinize uyan eğitmen yok' : 'No teachers match your filters'}</p>
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14" data-testid="teacher-grid">
                {filtered.slice(0, visible).map((teacher) => (
                  <TeacherCard key={teacher.id} teacher={teacher} />
                ))}
              </div>
              {filtered.length > visible && (
                <div className="mt-14 text-center">
                  <button type="button" data-testid="teachers-more" onClick={() => setVisible((v) => v + PAGE_SIZE)} className="btn-ghost">
                    {locale === 'tr' ? `Daha fazla göster (${filtered.length - visible} eğitmen daha)` : `Show more (${filtered.length - visible} more teachers)`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <Footer />
    </>
  );
}
