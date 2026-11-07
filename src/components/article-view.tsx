'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { ArticleCard, ArticleCardData, Cover, useDateFormat, useL } from '@/components/editorial';
import type { Block } from '@/lib/articles';

export interface ArticleData {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  coverUrl: string | null;
  publishedAt: string | null;
  author: string | null;
  minutes: number;
  blocks: Block[];
}

/** Renders parsed blocks as React elements — article text is never injected as HTML. */
function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="prose-aya">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'h2': return <h2 key={i}>{b.text}</h2>;
          case 'h3': return <h3 key={i}>{b.text}</h3>;
          case 'quote': return <blockquote key={i}>{b.text}</blockquote>;
          case 'ul': return <ul key={i}>{b.items.map((t, j) => <li key={j}>{t}</li>)}</ul>;
          default: return <p key={i}>{b.text}</p>;
        }
      })}
    </div>
  );
}

export default function ArticleView({ article: a, related }: { article: ArticleData; related: ArticleCardData[] }) {
  const L = useL();
  const f = useDateFormat();
  return (
    <>
      <Navbar />
      <main>
        <article>
          <header className="max-w-3xl mx-auto px-6 pt-12">
            <Link href="/icerikler" className="inline-flex items-center gap-2 text-sm text-sage-600 hover:text-ink mb-10">
              <ArrowLeft size={15} /> {L('Tüm yazılar', 'All articles')}
            </Link>
            <p className="eyebrow mb-5">{a.category}</p>
            <h1 data-testid="article-title" className="font-display font-light text-5xl md:text-6xl leading-[1.04]">{a.title}</h1>
            <p className="text-xl text-sage-600 mt-6 leading-relaxed">{a.excerpt}</p>
            <p className="mt-8 pt-5 border-t border-rule text-sm text-sage-600 flex flex-wrap gap-x-4">
              {a.author && <span className="font-medium text-ink">{a.author}</span>}
              {a.publishedAt && <span>{f.date(a.publishedAt)}</span>}
              <span>{a.minutes} {L('dk okuma', 'min read')}</span>
            </p>
          </header>

          <div className="max-w-5xl mx-auto px-6 mt-10">
            <Cover src={a.coverUrl} tone="clay" label={a.title[0]} className="aspect-[16/8]" />
          </div>

          <div className="max-w-2xl mx-auto px-6 mt-14" data-testid="article-body">
            <Blocks blocks={a.blocks} />
          </div>
        </article>

        {related.length > 0 && (
          <section className="max-w-7xl mx-auto px-6 lg:px-12 mt-24 pt-12 border-t border-ink">
            <p className="eyebrow mb-8">{L('Okumaya devam edin', 'Keep reading')}</p>
            <div className="grid md:grid-cols-3 gap-x-8 gap-y-12">
              {related.map((r) => <ArticleCard key={r.slug} a={r} />)}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
