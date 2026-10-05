import Link from "next/link"
import type { ReactNode } from "react"
import { Check, ChevronRight } from "lucide-react"

/**
 * Shared building blocks of the three panels (student, teacher, admin).
 * Quiet by design: hairline borders instead of shadows, sentence-case labels, numbers set in the body face,
 * one accent colour reserved for the single most important action on a screen.
 */

export const primaryBtn =
  "inline-flex items-center justify-center gap-2 min-h-[42px] px-4 rounded-lg bg-ink text-cream text-sm font-semibold hover:bg-sage-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream cursor-pointer"
export const accentBtn =
  "inline-flex items-center justify-center gap-2 min-h-[42px] px-4 rounded-lg bg-clay-500 text-white text-sm font-semibold hover:bg-clay-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay-600 focus-visible:ring-offset-2 focus-visible:ring-offset-cream cursor-pointer"
export const quietBtn =
  "inline-flex items-center justify-center gap-2 min-h-[42px] px-4 rounded-lg border border-rule bg-paper text-sm font-semibold text-sage-800 hover:border-sage-300 hover:bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream cursor-pointer"

export function PageHeader({ title, description, meta, actions }: { title: ReactNode; description?: ReactNode; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 mb-8">
      <div className="min-w-0">
        <h1 className="font-display text-3xl md:text-[2.5rem] leading-[1.1] text-ink">{title}</h1>
        {description && <p className="mt-2 text-[15px] leading-relaxed text-sage-600 max-w-2xl">{description}</p>}
        {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  )
}

export function Panel({ children, className = "", ...rest }: React.HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return <section {...rest} className={`bg-paper border border-rule rounded-xl ${className}`}>{children}</section>
}

export function PanelHeader({ title, description, href, hrefLabel, children }: { title: ReactNode; description?: ReactNode; href?: string; hrefLabel?: string; children?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {description && <p className="text-[13px] text-sage-500 mt-0.5">{description}</p>}
      </div>
      {href && <Link href={href} className="shrink-0 text-[13px] font-medium text-teal-700 hover:text-teal-900 inline-flex items-center gap-0.5 min-h-[28px]">{hrefLabel ?? "Tümü"} <ChevronRight size={14} aria-hidden /></Link>}
      {children}
    </div>
  )
}

/** One bordered strip with dividers instead of four separate icon tiles. */
export function StatStrip({ items, className = "", min = 150 }: { items: { label: string; value: ReactNode; hint?: ReactNode; tone?: "good" | "bad" }[]; className?: string; min?: number }) {
  return (
    <dl className={`grid bg-paper border border-rule rounded-xl divide-rule overflow-hidden ${className}`} style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))` }}>
      {items.map((s, i) => (
        <div key={s.label} className={`px-4 py-4 ${i > 0 ? "sm:border-l border-rule" : ""} ${i > 0 ? "border-t sm:border-t-0" : ""}`}>
          <dt className="text-[13px] text-sage-500">{s.label}</dt>
          <dd className={`mt-1 text-[1.65rem] leading-none font-semibold tabular-nums tracking-tight ${s.tone === "good" ? "text-teal-700" : s.tone === "bad" ? "text-clay-600" : "text-ink"}`}>{s.value}</dd>
          {s.hint && <p className="mt-1.5 text-xs text-sage-500">{s.hint}</p>}
        </div>
      ))}
    </dl>
  )
}

export function EmptyNote({ title, children, action }: { title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="px-5 pt-1 pb-5">
      <p className="text-[15px] font-medium text-ink">{title}</p>
      {children && <p className="mt-1 text-sm text-sage-600 max-w-md leading-relaxed">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Dot({ tone }: { tone: "live" | "wait" | "ok" | "off" }) {
  const c = tone === "live" ? "bg-clay-500" : tone === "wait" ? "bg-saffron-500" : tone === "ok" ? "bg-teal-500" : "bg-sage-300"
  return <span aria-hidden className={`inline-block w-2 h-2 rounded-full ${c} ${tone === "live" ? "animate-pulse" : ""}`} />
}

export function Checklist({ items }: { items: { done: boolean; title: string; text: string; href: string; cta: string }[] }) {
  return (
    <ol className="divide-y divide-rule">
      {items.map((it) => (
        <li key={it.title} className="flex items-start gap-3.5 px-5 py-3.5">
          <span aria-hidden className={`mt-0.5 shrink-0 w-5 h-5 rounded-full border flex items-center justify-center ${it.done ? "bg-teal-600 border-teal-600 text-white" : "border-sage-300 bg-paper"}`}>
            {it.done && <Check size={12} strokeWidth={3} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium ${it.done ? "text-sage-500 line-through decoration-sage-300" : "text-ink"}`}>{it.title}</p>
            {!it.done && <p className="text-[13px] text-sage-500 mt-0.5">{it.text}</p>}
          </div>
          {!it.done && <Link href={it.href} className="shrink-0 text-[13px] font-semibold text-teal-700 hover:text-teal-900 min-h-[32px] inline-flex items-center">{it.cta}</Link>}
          {it.done && <span className="sr-only">tamamlandı</span>}
        </li>
      ))}
    </ol>
  )
}
