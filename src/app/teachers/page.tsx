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

export default function TeachersPage() {
  const { t, locale } = useI18n();
  const [filters, setFilters] = useState<Filters>({ style: null, level: null, exp: null });
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

      <section className="relative bg-sage-900 pt-24 pb-20 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <svg className="absolute left-0 top-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none" stroke="currentColor" strokeWidth="0.5">
            <path d="M0,100 C30,60 70,40 100,0 L100,100 Z" fill="currentColor" opacity="0.2"/>
            <path d="M20,100 C50,50 80,30 100,0 L100,100 Z" fill="currentColor" opacity="0.4"/>
          </svg>
        </div>
        <div className="absolute top-20 right-20 w-64 h-64 bg-sage-500/20 rounded-full blur-3xl" />
        <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest text-sage-200 mb-6 border border-white/10">
            Global Instructors
          </div>
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl text-white mb-4 leading-tight">
            Find Your <span className="italic text-sage-300">Guide</span>
          </h1>
          <p className="text-sage-300 text-lg md:text-xl max-w-2xl font-light">
            {filtered.length} {t.filters.results} waiting to practice with you.
          </p>
        </div>
      </section>

      <section className="sticky top-20 z-40 bg-white/80 backdrop-blur-xl border-b border-sage-200/60 shadow-sm py-4">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex flex-wrap items-center gap-4 md:gap-8">
            {/* Style filter */}
            <div className="flex items-center gap-3">
              <label className="text-[10px] uppercase tracking-widest font-bold text-sage-400 hidden md:block">{t.filters.style}</label>
              <select
                value={filters.style ?? ''}
                onChange={(e) => setFilters({ ...filters, style: (e.target.value || null) as YogaStyle | null })}
                className="bg-white border border-sage-200 hover:border-sage-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-sage-800 focus:outline-none focus:ring-2 focus:ring-sage-500/20 cursor-pointer shadow-sm transition-all"
              >
                <option value="">All Styles</option>
                {YOGA_STYLES.map((s) => (
                  <option key={s.id} value={s.id}>{s[locale]}</option>
                ))}
              </select>
            </div>

            {/* Level filter */}
            <div className="flex items-center gap-3">
              <label className="text-[10px] uppercase tracking-widest font-bold text-sage-400 hidden md:block">{t.filters.level}</label>
              <select
                value={filters.level ?? ''}
                onChange={(e) => setFilters({ ...filters, level: (e.target.value || null) as Level | null })}
                className="bg-white border border-sage-200 hover:border-sage-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-sage-800 focus:outline-none focus:ring-2 focus:ring-sage-500/20 cursor-pointer shadow-sm transition-all"
              >
                <option value="">All Levels</option>
                <option value="beginner">{t.filters.levels.beginner}</option>
                <option value="intermediate">{t.filters.levels.intermediate}</option>
                <option value="advanced">{t.filters.levels.advanced}</option>
              </select>
            </div>

            {/* Experience filter */}
            <div className="flex items-center gap-3">
              <label className="text-[10px] uppercase tracking-widest font-bold text-sage-400 hidden md:block">{t.filters.experience}</label>
              <select
                value={filters.exp ?? ''}
                onChange={(e) => setFilters({ ...filters, exp: (e.target.value || null) as ExperienceBucket | null })}
                className="bg-white border border-sage-200 hover:border-sage-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-sage-800 focus:outline-none focus:ring-2 focus:ring-sage-500/20 cursor-pointer shadow-sm transition-all"
              >
                <option value="">Any Experience</option>
                <option value="lt2">{t.filters.experiences.lt2}</option>
                <option value="2to5">{t.filters.experiences['2to5']}</option>
                <option value="5to10">{t.filters.experiences['5to10']}</option>
                <option value="10plus">{t.filters.experiences['10plus']}</option>
              </select>
            </div>

            {hasActiveFilters && (
              <button
                onClick={() => setFilters({ style: null, level: null, exp: null })}
                className="ml-auto text-xs font-bold uppercase tracking-wider text-sage-500 hover:text-sage-900 bg-sage-50 hover:bg-sage-100 px-4 py-2.5 rounded-xl transition-colors"
              >
                {t.filters.clear}
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="py-12 bg-cream min-h-[60vh]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          {/* DB teachers section */}
          {dbTeachers.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <span className="text-sm font-medium text-sage-600">Verified Teachers</span>
              </div>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-ink/60 font-display text-xl italic">No teachers match your filters.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {filtered.map((teacher) => (
                <TeacherCard key={teacher.id} teacher={teacher} />
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </>
  );
}
