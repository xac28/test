'use client';

import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { WorkshopCard, WorkshopCardData, useL } from '@/components/editorial';
import { WORKSHOP_CATEGORIES } from '@/lib/workshops';

export default function WorkshopsView({
  items,
  filters,
}: {
  items: WorkshopCardData[];
  filters: { mode: string | null; category: string | null; past: boolean };
}) {
  const L = useL();
  const href = (over: Partial<{ mode: string | null; category: string | null; past: boolean }>) => {
    const f = { ...filters, ...over };
    const q = new URLSearchParams();
    if (f.mode) q.set('mode', f.mode);
    if (f.category) q.set('category', f.category);
    if (f.past) q.set('past', '1');
    const s = q.toString();
    return `/atolyeler${s ? `?${s}` : ''}`;
  };

  const Chip = ({ active, to, children, testId }: { active: boolean; to: string; children: React.ReactNode; testId?: string }) => (
    <Link
      href={to}
      data-testid={testId}
      aria-current={active ? 'true' : undefined}
      className={`px-4 py-2 text-sm border rounded-md transition-colors ${active ? 'bg-ink text-cream border-ink' : 'border-rule text-sage-700 hover:border-ink'}`}
    >
      {children}
    </Link>
  );

  return (
    <>
      <Navbar />
      <main>
        <section className="border-b border-rule">
          <div className="max-w-7xl mx-auto px-6 lg:px-12 pt-16 pb-12">
            <p className="eyebrow mb-4">{L('Atölyeler', 'Workshops')}</p>
            <h1 className="font-display font-light text-5xl md:text-7xl leading-[1.0] max-w-4xl">
              {L('Birlikte öğrenmek,', 'Learning together,')} <em className="italic text-clay-500">{L('küçük gruplarla.', 'in small groups.')}</em>
            </h1>
            <p className="mt-6 text-lg text-sage-600 max-w-2xl">
              {L(
                'Canlı atölyeler belirli bir günde, sınırlı kontenjanla yapılır. Kayıtlı atölyeleri istediğiniz zaman izleyebilirsiniz.',
                'Live workshops run on a set day with limited seats. Recorded workshops you can watch whenever you like.'
              )}
            </p>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-6 lg:px-12 py-10">
          <div className="space-y-4 mb-12">
            <div className="flex flex-wrap gap-2" aria-label={L('Tür', 'Type')}>
              <Chip active={!filters.mode && !filters.past} to={href({ mode: null, past: false })}>{L('Tümü', 'All')}</Chip>
              <Chip active={filters.mode === 'LIVE' && !filters.past} to={href({ mode: 'LIVE', past: false })} testId="filter-live">{L('Canlı', 'Live')}</Chip>
              <Chip active={filters.mode === 'RECORDED' && !filters.past} to={href({ mode: 'RECORDED', past: false })} testId="filter-recorded">{L('Kayıtlı', 'Recorded')}</Chip>
              <Chip active={filters.past} to={href({ mode: null, past: true })} testId="filter-past">{L('Geçmiş', 'Past')}</Chip>
            </div>
            <div className="flex flex-wrap gap-2" aria-label={L('Kategori', 'Category')}>
              <Chip active={!filters.category} to={href({ category: null })}>{L('Tüm kategoriler', 'All categories')}</Chip>
              {WORKSHOP_CATEGORIES.map((c) => (
                <Chip key={c} active={filters.category === c} to={href({ category: c })}>{c}</Chip>
              ))}
            </div>
          </div>

          {items.length === 0 ? (
            <div data-testid="no-workshops" className="border border-dashed border-rule py-24 text-center">
              <p className="font-display text-3xl mb-2">{L('Bu filtrede atölye yok', 'No workshops match')}</p>
              <p className="text-sage-600">{L('Filtreleri değiştirin ya da yakında yeni atölyeler için tekrar uğrayın.', 'Change the filters or check back soon.')}</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14">
              {items.map((w) => (
                <WorkshopCard key={w.slug} w={w} />
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
