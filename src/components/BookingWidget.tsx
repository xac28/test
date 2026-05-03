'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Teacher } from '@/lib/teachers';
import { useI18n } from '@/i18n';
import { groupSlotsByDay, formatLocalDate, formatLocalTime, userTimezone } from '@/lib/time';
import { formatLocalPrice, formatUSD, localCurrencyCode } from '@/lib/currency';

export default function BookingWidget({ teacher }: { teacher: Teacher }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [classType, setClassType] = useState<'trial' | 'regular'>('trial');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const grouped = useMemo(() => groupSlotsByDay(teacher.availability), [teacher.availability]);
  const days = Object.keys(grouped).sort();

  const price = classType === 'trial' ? teacher.trialPriceUSD : teacher.pricePerClassUSD;

  const handleProceed = () => {
    if (!selectedSlot) return;
    const params = new URLSearchParams({
      teacher: teacher.slug,
      slot: selectedSlot,
      type: classType,
    });
    router.push(`/checkout?${params.toString()}`);
  };

  return (
    <div className="bg-cream rounded-3xl border border-sage-200 p-6 lg:p-8 shadow-sm">
      <h2 className="font-display text-2xl text-ink mb-1">{t.profile.bookNow}</h2>
      <p className="text-xs text-ink/50 mb-6">
        {t.profile.timezone} ({userTimezone()})
      </p>

      {/* Class type selector */}
      <div className="grid grid-cols-2 gap-2 mb-6">
        <button
          onClick={() => setClassType('trial')}
          className={`p-4 rounded-2xl border-2 transition-all text-left ${
            classType === 'trial'
              ? 'border-sage-600 bg-sage-50'
              : 'border-sage-100 hover:border-sage-300'
          }`}
        >
          <div className="text-xs uppercase tracking-wide text-clay-600 mb-1">
            {t.profile.fiftyOff}
          </div>
          <div className="font-medium text-ink mb-1">{t.profile.trialClass}</div>
          <div className="font-display text-xl text-sage-700">
            {formatLocalPrice(teacher.trialPriceUSD)}
          </div>
        </button>

        <button
          onClick={() => setClassType('regular')}
          className={`p-4 rounded-2xl border-2 transition-all text-left ${
            classType === 'regular'
              ? 'border-sage-600 bg-sage-50'
              : 'border-sage-100 hover:border-sage-300'
          }`}
        >
          <div className="text-xs uppercase tracking-wide text-ink/40 mb-1">60 min</div>
          <div className="font-medium text-ink mb-1">{t.profile.regularClass}</div>
          <div className="font-display text-xl text-ink">
            {formatLocalPrice(teacher.pricePerClassUSD)}
          </div>
        </button>
      </div>

      {/* Day selector */}
      <div className="mb-6">
        <label className="text-xs uppercase tracking-wide text-ink/50 mb-3 block">
          {t.profile.selectDate}
        </label>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {days.slice(0, 14).map((day) => {
            // Build display from a slot in that day
            const sample = grouped[day][0];
            const isSelected = selectedDay === day;
            return (
              <button
                key={day}
                onClick={() => {
                  setSelectedDay(day);
                  setSelectedSlot(null);
                }}
                className={`flex-shrink-0 px-4 py-3 rounded-2xl border-2 transition-all min-w-[88px] text-center ${
                  isSelected
                    ? 'border-sage-600 bg-sage-100'
                    : 'border-sage-100 hover:border-sage-300'
                }`}
              >
                <div className="text-xs text-ink/60">
                  {formatLocalDate(sample, locale).split(',')[0]}
                </div>
                <div className="font-display text-lg text-ink mt-0.5">
                  {formatLocalDate(sample, locale).split(',')[1]?.trim()}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time selector */}
      {selectedDay && (
        <div className="mb-6 animate-fade-in">
          <label className="text-xs uppercase tracking-wide text-ink/50 mb-3 block">
            {t.profile.selectTime}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {grouped[selectedDay].map((slot) => {
              const isSelected = selectedSlot === slot;
              return (
                <button
                  key={slot}
                  onClick={() => setSelectedSlot(slot)}
                  className={`px-3 py-3 rounded-xl border-2 transition-all text-sm font-medium ${
                    isSelected
                      ? 'border-sage-600 bg-sage-700 text-cream'
                      : 'border-sage-100 hover:border-sage-300 text-ink'
                  }`}
                >
                  {formatLocalTime(slot, locale)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary + CTA */}
      <div className="mt-6 pt-6 border-t border-sage-100">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-ink/60">{t.checkout.price}</div>
          <div className="text-right">
            <div className="font-display text-2xl text-sage-700">
              {formatLocalPrice(price)}
            </div>
            {localCurrencyCode() !== 'USD' && (
              <div className="text-xs text-ink/50">{t.checkout.chargedAs} {formatUSD(price)}</div>
            )}
          </div>
        </div>

        <button
          onClick={handleProceed}
          disabled={!selectedSlot}
          className={`w-full py-4 rounded-full font-medium transition-all ${
            selectedSlot
              ? 'bg-sage-700 hover:bg-sage-800 text-cream'
              : 'bg-sage-100 text-ink/30 cursor-not-allowed'
          }`}
        >
          {t.profile.proceedPayment}
        </button>
      </div>
    </div>
  );
}
