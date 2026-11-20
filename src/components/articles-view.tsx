'use client';

import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { ArticleCard, ArticleCardData, useL } from '@/components/editorial';
import { ARTICLE_CATEGORIES } from '@/lib/articles';

export default function ArticlesView({ items, category }: { items: ArticleCardData[]; category: string | null }) {
  const L = useL();
  const chip = (active: boolean) =>
    `px-4 py-2 text-sm border rounded-md transition-colors ${active ? 'bg-ink text-cream border-ink' : 'border-rule text-sage-700 hover:border-ink'}`;

  return (
    <>
      <Navbar />
      <main>
        <section className="border-b border-rule">
          <div className="max-w-7xl mx-auto px-6 lg:px-12 pt-16 pb-12">
            <p className="eyebrow mb-4">{L('İçerikler', 'Journal')}</p>
            <h1 className="font-display font-light text-5xl md:text-7xl leading-[1.0] max-w-4xl">
              {L('Nefes, beden ve zihin üzerine', 'Writing on breath,')} <em className="italic text-clay-500">{L('yazılar.', 'body and mind.')}</em>
            </h1>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-6 lg:px-12 py-10">
          <div className="flex flex-wrap gap-2 mb-12">
            <Link href="/icerikler" className={chip(!category)}>{L('Tümü', 'All')}</Link>
            {ARTICLE_CATEGORIES.map((c) => (
              <Link key={c} href={`/icerikler?category=${encodeURIComponent(c)}`} className={chip(category === c)}>{c}</Link>
            ))}
          </div>

          {items.length === 0 ? (
            <div data-testid="no-articles" className="border border-dashed border-rule py-24 text-center">
              <p className="font-display text-3xl mb-2">{L('Henüz yazı yok', 'No articles yet')}</p>
              <p className="text-sage-600">{L('Yakında burada yeni yazılar olacak.', 'New articles will appear here soon.')}</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-x-8 gap-y-14">
              {items.map((a, i) => (
                <ArticleCard key={a.slug} a={a} large={i === 0 && !category} />
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
