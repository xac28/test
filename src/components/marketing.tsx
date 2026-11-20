import Link from "next/link"
import { ReactNode } from "react"
import { ArrowRight, ChevronDown } from "lucide-react"

/** Hero band used by the information pages: soft gradient, eyebrow, serif headline with an accent word. */
export function PageHero({ eyebrow, title, accent, lead, children, tone = "peach" }: { eyebrow: string; title: string; accent?: string; lead?: string; children?: ReactNode; tone?: "peach" | "mint" | "teal" }) {
  const bg = tone === "teal" ? "surface-teal text-white" : tone === "mint" ? "surface-mint" : "surface-peach"
  return (
    <section className={`relative overflow-hidden border-b border-rule ${bg}`}>
      <div className="absolute -right-24 -top-24 w-80 h-80 rounded-full bg-white/25 blur-3xl" aria-hidden />
      <div className="absolute -left-24 bottom-0 w-72 h-72 rounded-full bg-saffron-200/30 blur-3xl" aria-hidden />
      <div className="relative max-w-7xl mx-auto px-6 lg:px-12 pt-16 pb-14 lg:pt-24 lg:pb-20">
        <p className={`eyebrow mb-4 ${tone === "teal" ? "!text-saffron-300" : ""}`}>{eyebrow}</p>
        <h1 className="font-display font-light text-5xl md:text-7xl leading-[1.02] max-w-4xl">
          {title} {accent && <em className={`italic ${tone === "teal" ? "text-saffron-300" : "text-clay-500"}`}>{accent}</em>}
        </h1>
        {lead && <p className={`mt-6 text-lg max-w-2xl leading-relaxed ${tone === "teal" ? "text-white/80" : "text-sage-600"}`}>{lead}</p>}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  )
}

export function CtaBand({ title, text, href, label, secondary }: { title: string; text?: string; href: string; label: string; secondary?: { href: string; label: string } }) {
  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-12 py-20">
      <div className="surface-teal rounded-3xl p-10 md:p-14 grid md:grid-cols-12 gap-8 items-center relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-clay-500/30 blur-3xl" aria-hidden />
        <div className="md:col-span-8 relative">
          <h2 className="font-display text-3xl md:text-5xl leading-[1.05]">{title}</h2>
          {text && <p className="mt-4 text-white/75 max-w-xl leading-relaxed">{text}</p>}
        </div>
        <div className="md:col-span-4 md:text-right relative flex flex-wrap gap-3 md:justify-end">
          <Link href={href} className="btn-cta">{label} <ArrowRight size={16} /></Link>
          {secondary && <Link href={secondary.href} className="inline-flex items-center px-5 py-3 text-sm font-semibold text-white/90 hover:text-white underline underline-offset-4">{secondary.label}</Link>}
        </div>
      </div>
    </section>
  )
}

/** Accessible accordion made of native <details>. */
export function FaqList({ items, className = "" }: { items: { q: string; a: ReactNode }[]; className?: string }) {
  return (
    <div className={`divide-y divide-rule border-y border-rule ${className}`} data-testid="faq-list">
      {items.map((it) => (
        <details key={it.q} className="group py-1" data-testid="faq-item">
          <summary className="flex items-center justify-between gap-6 cursor-pointer list-none py-5 font-display text-xl md:text-2xl min-h-[44px] [&::-webkit-details-marker]:hidden">
            {it.q}
            <ChevronDown className="shrink-0 text-clay-500 transition-transform group-open:rotate-180" size={22} />
          </summary>
          <div className="pb-6 pr-10 text-sage-700 leading-relaxed">{it.a}</div>
        </details>
      ))}
    </div>
  )
}

export function Intensity({ value, label = "Yoğunluk" }: { value: number; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5" role="img" aria-label={`${label}: ${value}/5`}>
      {[1, 2, 3, 4, 5].map((n) => <span key={n} className={`w-2 h-2 rounded-full ${n <= value ? "bg-clay-500" : "bg-sage-200"}`} />)}
    </span>
  )
}

export function Section({ eyebrow, title, children, className = "" }: { eyebrow?: string; title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`max-w-7xl mx-auto px-6 lg:px-12 py-16 ${className}`}>
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      {title && <h2 className="font-display text-4xl md:text-5xl leading-[1.05] mb-10 max-w-3xl">{title}</h2>}
      {children}
    </section>
  )
}
