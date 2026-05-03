'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Teacher } from '@/lib/teachers';
import { useI18n } from '@/i18n';
import { styleLabel } from '@/lib/constants';
import { formatLocalPrice, localCurrencyCode } from '@/lib/currency';
import { BadgeCheck, Star, Clock, MapPin, PlayCircle } from 'lucide-react';

export default function TeacherCard({ teacher }: { teacher: Teacher }) {
  const { t, locale } = useI18n();
  const [localPrice, setLocalPrice] = useState<string>('');
  const [currency, setCurrency] = useState<string>('USD');

  useEffect(() => {
    setLocalPrice(formatLocalPrice(teacher.trialPriceUSD));
    setCurrency(localCurrencyCode());
  }, [teacher.trialPriceUSD]);

  return (
    <div className="group bg-white/70 backdrop-blur-sm rounded-[2rem] border border-sage-200/60 overflow-hidden hover:shadow-[0_20px_40px_-15px_rgba(44,59,39,0.2)] hover:border-sage-300 transition-all duration-500 hover:-translate-y-1 relative">
      <div className="aspect-[4/3] relative overflow-hidden bg-sage-100">
        <Image
          src={teacher.avatar}
          alt={teacher.name}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover group-hover:scale-110 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60"></div>
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
          <span className="text-sm leading-none">{teacher.countryFlag}</span>
          <span className="text-sage-900">{teacher.country}</span>
        </div>
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md rounded-full px-3 py-1.5 text-[11px] font-bold flex items-center gap-1 shadow-sm">
          <Star size={12} className="text-yellow-500 fill-yellow-500" />
          <span className="text-sage-900">{teacher.rating}</span>
          <span className="text-sage-500">({teacher.reviewCount})</span>
        </div>
        
        {teacher.videoIntroUrl && (
          <div className="absolute bottom-4 right-4 bg-white/20 backdrop-blur-md hover:bg-white/40 transition-colors rounded-full p-2 text-white cursor-pointer shadow-lg border border-white/20">
            <PlayCircle size={24} />
          </div>
        )}
      </div>

      <div className="p-6 relative">
        {(teacher as any)._isDbTeacher && (
          <div className="absolute -top-12 left-4 bg-white p-1 rounded-full shadow-md z-10">
            <BadgeCheck size={28} className="text-blue-500 fill-blue-50" />
          </div>
        )}
        <div className="flex items-start justify-between mb-3 mt-1">
          <div>
            <h3 className="font-display text-2xl text-sage-900 group-hover:text-sage-700 transition-colors">{teacher.name}</h3>
            <p className="text-xs text-sage-500 font-medium uppercase tracking-wider mt-1 flex items-center gap-1.5">
              <Clock size={12}/> {teacher.yearsExperience} {t.card.yearsExp}
            </p>
          </div>
        </div>

        <p className="text-sm text-sage-600 line-clamp-2 mb-5 min-h-[2.5rem] leading-relaxed">
          {teacher.bio[locale]}
        </p>

        <div className="flex flex-wrap gap-2 mb-6">
          {teacher.styles.slice(0, 3).map((s) => (
            <span
              key={s}
              className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg bg-sage-50 text-sage-700 border border-sage-200/60"
            >
              {styleLabel(s, locale)}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between pt-5 border-t border-sage-100">
          <div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-sage-400 mb-0.5">{t.card.trialFrom}</div>
            <div className="font-display text-2xl text-sage-800 flex items-baseline gap-1">
              {localPrice}
              {currency !== 'USD' && (
                <span className="text-[11px] text-sage-400 font-sans font-medium">≈ ${teacher.trialPriceUSD}</span>
              )}
            </div>
          </div>
          <Link
            href={`/teachers/${teacher.slug}`}
            className="bg-sage-900 hover:bg-sage-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md btn-press"
          >
            {t.card.viewProfile}
          </Link>
        </div>
      </div>
    </div>
  );
}
