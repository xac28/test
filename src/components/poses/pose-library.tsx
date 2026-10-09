"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { Play, Search, Square } from "lucide-react"
import { POSES, POSE_CATEGORIES, POSE_LEVELS, PoseCategory, PoseLevel, poseImage } from "@/lib/yoga-poses"
import { STYLES } from "@/lib/yoga-styles"
import { fold } from "@/lib/ai-knowledge"

const PoseMotion = dynamic(() => import("@/components/three/pose-motion"), { ssr: false })

/**
 * A pose card. Hovering it with a mouse (or pressing its play button, which also works on touch screens and with the
 * keyboard) lets the 3D character perform the pose from start to finish, in a loop; the still picture is shown otherwise.
 */
export function PoseCard({ slug }: { slug: string }) {
  const p = POSES.find((x) => x.slug === slug)!
  const [hover, setHover] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [ready, setReady] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const active = hover || pinned

  useEffect(() => { if (!active) setReady(false) }, [active])
  useEffect(() => () => clearTimeout(timer.current), [])

  const enter = (e: React.PointerEvent) => {
    if (e.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setHover(true), 140) // sweeping the mouse over the grid should not start every figure
  }
  const leave = () => {
    clearTimeout(timer.current)
    setHover(false)
  }

  return (
    <div data-testid="pose-card" data-playing={active ? "1" : "0"} onPointerEnter={enter} onPointerLeave={leave} className="group relative rounded-2xl overflow-hidden bg-paper border border-rule card-lift">
      <Link href={`/pozlar/${p.slug}`} className="block">
        <div className="relative aspect-[4/5] bg-gradient-to-br from-clay-100 to-teal-100 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={poseImage(p.slug)} alt={`${p.name} (${p.sanskrit}) duruşu`} loading="lazy" className={`w-full h-full object-cover transition-all duration-500 ${active ? (ready ? "opacity-0" : "opacity-100") : "group-hover:scale-105"}`} />
          {active && (
            <div className="absolute inset-0 animate-fade-in" data-testid="pose-card-motion" data-ready={ready ? "1" : "0"}>
              <PoseMotion slug={p.slug} onReady={() => setReady(true)} />
            </div>
          )}
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
      <button
        type="button"
        data-testid="pose-play"
        aria-pressed={pinned}
        aria-label={pinned ? `${p.name} hareketini durdur` : `${p.name} hareketini izle`}
        onClick={() => { clearTimeout(timer.current); setPinned((v) => !v) }}
        className={`absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full pl-2.5 pr-3 min-h-[44px] text-xs font-semibold shadow-md backdrop-blur border transition ${pinned ? "bg-ink text-cream border-ink" : "bg-paper/90 text-ink border-rule hover:border-ink"}`}
      >
        {pinned ? <Square size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
        <span>{pinned ? "Durdur" : "Hareketi izle"}</span>
      </button>
    </div>
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
