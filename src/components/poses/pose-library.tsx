"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { POSES, POSE_CATEGORIES, POSE_LEVELS, PoseCategory, PoseLevel, poseImage } from "@/lib/yoga-poses"
import { STYLES } from "@/lib/yoga-styles"
import { fold } from "@/lib/ai-knowledge"

export function PoseCard({ slug }: { slug: string }) {
  const p = POSES.find((x) => x.slug === slug)!
  return (
    <Link href={`/pozlar/${p.slug}`} data-testid="pose-card" className="group block rounded-2xl overflow-hidden bg-paper border border-rule card-lift">
      <div className="aspect-[4/5] bg-gradient-to-br from-clay-100 to-teal-100 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={poseImage(p.slug)} alt={`${p.name} (${p.sanskrit}) duruşu`} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider">
          <span className="text-teal-600">{p.category}</span>
          <span className={p.level === "Başlangıç" ? "text-teal-600" : p.level === "Orta" ? "text-saffron-600" : "text-clay-600"}>{p.level}</span>
        </div>
        <h3 className="font-display text-2xl mt-1.5 group-hover:text-clay-600 transition-colors">{p.name}</h3>
        <p className="text-sm italic text-sage-500">{p.sanskrit}</p>
        <p className="text-sm text-sage-600 mt-2 line-clamp-2">{p.summary}</p>
      </div>
    </Link>
  )
}

export default function PoseLibrary() {
  const [q, setQ] = useState("")
  const [cat, setCat] = useState<PoseCategory | "">("")
  const [level, setLevel] = useState<PoseLevel | "">("")
  const [style, setStyle] = useState("")
  const list = useMemo(() => {
    const f = fold(q)
    return POSES.filter((p) => (!cat || p.category === cat) && (!level || p.level === level) && (!style || p.styles.includes(style)) && (!f || fold(`${p.name} ${p.english} ${p.sanskrit} ${p.summary} ${p.benefits.join(" ")}`).includes(f)))
  }, [q, cat, level, style])
  const chip = (active: boolean) => `px-4 py-2 min-h-[40px] rounded-full text-sm border transition ${active ? "bg-ink text-cream border-ink" : "bg-paper border-rule text-sage-700 hover:border-sage-400"}`

  return (
    <div>
      <div className="space-y-4 mb-10" data-testid="pose-filters">
        <div className="relative max-w-md">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-sage-400" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Poz ara: ağaç, tadasana, bel ağrısı…" aria-label="Poz ara" data-testid="pose-search" className="w-full pl-11 pr-4 py-3 bg-paper border border-rule rounded-full text-sm focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink" />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Kategori">
          <button className={chip(!cat)} onClick={() => setCat("")} data-testid="cat-all">Tümü</button>
          {POSE_CATEGORIES.map((c) => <button key={c} className={chip(cat === c)} aria-pressed={cat === c} onClick={() => setCat(cat === c ? "" : c)} data-testid={`cat-${c}`}>{c}</button>)}
        </div>
        <div className="flex flex-wrap gap-2 items-center" role="group" aria-label="Seviye ve stil">
          {POSE_LEVELS.map((l) => <button key={l} className={chip(level === l)} aria-pressed={level === l} onClick={() => setLevel(level === l ? "" : l)} data-testid={`level-${l}`}>{l}</button>)}
          <span className="w-px h-6 bg-rule mx-1" aria-hidden />
          {STYLES.map((s) => <button key={s.slug} className={chip(style === s.slug)} aria-pressed={style === s.slug} onClick={() => setStyle(style === s.slug ? "" : s.slug)}>{s.name}</button>)}
        </div>
      </div>
      <p className="text-sm text-sage-500 mb-5" aria-live="polite" data-testid="pose-count">{list.length} poz</p>
      {list.length === 0 ? (
        <div className="border border-dashed border-rule rounded-2xl py-20 text-center" data-testid="pose-empty">
          <p className="font-display text-3xl mb-2">Eşleşen poz yok</p>
          <p className="text-sage-600">Aramayı ya da filtreleri değiştirmeyi dene.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" data-testid="pose-grid">
          {list.map((p) => <PoseCard key={p.slug} slug={p.slug} />)}
        </div>
      )}
    </div>
  )
}
