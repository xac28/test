'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Teacher } from '@/lib/teachers';
import { useI18n } from '@/i18n';
import { styleLabel } from '@/lib/constants';
import { formatLocalPrice, localCurrencyCode } from '@/lib/currency';
import { Star } from 'lucide-react';
import { Cover } from '@/components/editorial';

export default function TeacherCard({ teacher }: { teacher: Teacher }) {
  const { t, locale } = useI18n();
  const [localPrice, setLocalPrice] = useState<string>('');
  const [currency, setCurrency] = useState<string>('USD');

  useEffect(() => {
    setLocalPrice(formatLocalPrice(teacher.trialPriceUSD));
    setCurrency(localCurrencyCode());
  }, [teacher.trialPriceUSD]);

  return (
    <article className="group" data-testid="teacher-card">
      <Link href={`/teachers/${teacher.slug}`} className="block" aria-label={teacher.name}>
        <Cover src={teacher.avatar} alt={teacher.name} tone="sage" label={teacher.name[0]} person={teacher.name} className="aspect-[4/5] mb-4" />
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-2xl leading-snug">
            <Link href={`/teachers/${teacher.slug}`} className="hover:underline underline-offset-4 decoration-1">{teacher.name}</Link>
          </h3>
          <p className="eyebrow mt-1">
            {teacher.country && teacher.country !== 'Unknown' ? `${teacher.country} · ` : ''}
            {teacher.yearsExperience} {t.card.yearsExp}
          </p>
        </div>
        <span className="flex items-center gap-1 text-sm font-medium shrink-0">
          <Star size={14} className="fill-clay-500 text-clay-500" /> {teacher.rating}
          <span className="text-sage-500 font-normal">({teacher.reviewCount})</span>
        </span>
      </div>

      <p className="text-sm text-sage-600 line-clamp-2 mt-3 min-h-[2.6rem] leading-relaxed">{teacher.bio[locale]}</p>

      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-sm font-display italic text-sage-700">
        {Array.from(new Set(teacher.styles)).slice(0, 3).map((s) => (
          <span key={s}>{styleLabel(s, locale)}</span>
        ))}
      </div>

      <div className="flex items-end justify-between mt-5 pt-4 border-t border-rule">
        <div>
          <p className="eyebrow">{t.card.trialFrom}</p>
          <p className="font-display text-2xl">
            {localPrice}
            {currency !== 'USD' && <span className="text-xs text-sage-500 font-sans ml-1.5">≈ ${teacher.trialPriceUSD}</span>}
          </p>
        </div>
        <Link href={`/teachers/${teacher.slug}`} className="text-sm font-semibold underline underline-offset-[5px] decoration-1 hover:text-clay-600">
          {t.card.viewProfile}
        </Link>
      </div>
    </article>
  );
}
