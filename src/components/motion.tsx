"use client"

import dynamic from "next/dynamic"
import { CSSProperties, ElementType, ReactNode, useEffect, useRef, useState } from "react"
import { animate, motion, useInView, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion"

const EASE = [0.16, 1, 0.3, 1] as const

/** True on devices with a real hover-capable pointer (mouse / trackpad) — pointer effects are skipped on touch. */
function useFinePointer() {
  const [fine, setFine] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)")
    const sync = () => setFine(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])
  return fine
}

/** The 3D scene is loaded on the client only (three.js is ~150 kB and needs WebGL). */
export const MeditationScene = dynamic(() => import("@/components/three/meditation-scene").then((m) => m.MeditationScene), {
  ssr: false,
  loading: () => <div className="absolute inset-0" aria-hidden />,
})

/** Fade-and-rise when scrolled into view (once). Respects reduced-motion. */
export function Reveal({ children, delay = 0, y = 28, className = "" }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

/** Container whose direct <StaggerItem/> children enter one after another. */
export function Stagger({ children, className = "", gap = 0.09 }: { children: ReactNode; className?: string; gap?: number }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : "hidden"}
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </motion.div>
  )
}
export function StaggerItem({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } } }}>
      {children}
    </motion.div>
  )
}

/**
 * Full-bleed photo with a slow "Ken Burns" drift. Tries each source in order; if none loads nothing is shown
 * (the parent's gradient stays), so a missing photo never leaves a broken-image icon.
 */
export function PhotoBackdrop({ sources, className = "", opacity = 1, drift = true }: { sources: readonly string[]; className?: string; opacity?: number; drift?: boolean }) {
  const [i, setI] = useState(0)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    setI(0)
    setReady(false)
  }, [sources])
  if (i >= sources.length) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={sources[i]}
      alt=""
      aria-hidden
      loading="lazy"
      onError={() => setI((n) => n + 1)}
      onLoad={() => setReady(true)}
      style={{ opacity: ready ? opacity : 0 }}
      className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${drift ? "animate-kenburns" : ""} ${className}`}
    />
  )
}

/** Endless horizontal ticker (pauses on hover). */
export function Marquee({ items }: { items: ReactNode[] }) {
  return (
    <div className="marquee group" aria-hidden={false}>
      <div className="marquee-track group-hover:[animation-play-state:paused]">
        {[...items, ...items].map((it, i) => (
          <span key={i} className="shrink-0 px-5">{it}</span>
        ))}
      </div>
    </div>
  )
}

/** Animated gradient blobs behind a hero. Purely decorative. */
export function Aurora({ className = "", dark = false }: { className?: string; dark?: boolean }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${dark ? "aurora-dark" : ""} ${className}`} aria-hidden>
      <div className="aurora-blob aurora-a" />
      <div className="aurora-blob aurora-b" />
      <div className="aurora-blob aurora-c" />
    </div>
  )
}

// ───────── motion system v2 ─────────

/**
 * Heading whose words rise out of a mask, one after another. The words stay real text (selectable, searchable,
 * read aloud as one sentence). `inView` waits until the heading is scrolled to; otherwise it plays on load.
 */
export function SplitText({
  text,
  as: Tag = "span",
  className = "",
  wordClassName = "",
  delay = 0,
  stagger = 0.06,
  inView = false,
}: {
  text: string
  as?: ElementType
  className?: string
  wordClassName?: string
  delay?: number
  stagger?: number
  inView?: boolean
}) {
  const reduce = useReducedMotion()
  const words = text.split(" ").filter(Boolean)
  const trigger = inView ? { whileInView: "show", viewport: { once: true, margin: "-40px" } } : { animate: "show" }
  return (
    <Tag className={className}>
      <motion.span
        initial={reduce ? false : "hidden"}
        {...trigger}
        variants={{ hidden: {}, show: { transition: { staggerChildren: stagger, delayChildren: delay } } }}
      >
        {words.map((w, i) => (
          <span key={i}>
            <span className="inline-block overflow-hidden align-bottom pb-[0.14em] -mb-[0.14em] pr-[0.08em] -mr-[0.08em]">
              <motion.span
                className={`inline-block will-change-transform ${wordClassName}`}
                variants={{ hidden: { y: "108%", rotate: 3 }, show: { y: 0, rotate: 0, transition: { duration: 0.9, ease: EASE } } }}
              >
                {w}
              </motion.span>
            </span>
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </motion.span>
    </Tag>
  )
}

/** A number that counts up when it scrolls into view. Server HTML and reduced-motion visitors see the final value. */
export function Counter({ to, suffix = "", prefix = "", duration = 1.8, className = "" }: { to: number; suffix?: string; prefix?: string; duration?: number; className?: string }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const seen = useInView(ref, { once: true, margin: "-40px" })
  const [n, setN] = useState(to)
  useEffect(() => {
    if (!seen || reduce) return
    const c = animate(0, to, { duration, ease: EASE, onUpdate: (v) => setN(Math.round(v)) })
    return () => c.stop()
  }, [seen, reduce, to, duration])
  return <span ref={ref} className={`tabular-nums ${className}`}>{prefix}{n}{suffix}</span>
}

/** Pulls its child a little towards the pointer while it hovers over it (mouse only). */
export function Magnetic({ children, strength = 0.28, className = "" }: { children: ReactNode; strength?: number; className?: string }) {
  const reduce = useReducedMotion()
  const fine = useFinePointer()
  const ref = useRef<HTMLDivElement>(null)
  const x = useSpring(useMotionValue(0), { stiffness: 220, damping: 18, mass: 0.4 })
  const y = useSpring(useMotionValue(0), { stiffness: 220, damping: 18, mass: 0.4 })
  const on = fine && !reduce
  return (
    <motion.div
      ref={ref}
      className={`inline-block ${className}`}
      style={on ? { x, y } : undefined}
      onPointerMove={(e) => {
        if (!on || !ref.current) return
        const r = ref.current.getBoundingClientRect()
        x.set((e.clientX - (r.left + r.width / 2)) * strength)
        y.set((e.clientY - (r.top + r.height / 2)) * strength)
      }}
      onPointerLeave={() => { x.set(0); y.set(0) }}
    >
      {children}
    </motion.div>
  )
}

/** Card that leans towards the pointer with a soft light following it (mouse only). */
export function Tilt({ children, max = 5, className = "" }: { children: ReactNode; max?: number; className?: string }) {
  const reduce = useReducedMotion()
  const fine = useFinePointer()
  const ref = useRef<HTMLDivElement>(null)
  const rx = useSpring(useMotionValue(0), { stiffness: 180, damping: 20 })
  const ry = useSpring(useMotionValue(0), { stiffness: 180, damping: 20 })
  const on = fine && !reduce
  return (
    <motion.div
      ref={ref}
      className={`tilt ${className}`}
      style={on ? { rotateX: rx, rotateY: ry, transformPerspective: 900 } : undefined}
      onPointerMove={(e) => {
        if (!on || !ref.current) return
        const r = ref.current.getBoundingClientRect()
        const px = (e.clientX - r.left) / r.width
        const py = (e.clientY - r.top) / r.height
        ry.set((px - 0.5) * 2 * max)
        rx.set(-(py - 0.5) * 2 * max)
        ref.current.style.setProperty("--mx", `${px * 100}%`)
        ref.current.style.setProperty("--my", `${py * 100}%`)
      }}
      onPointerLeave={() => { rx.set(0); ry.set(0) }}
    >
      {children}
      <span className="tilt-glare" aria-hidden />
    </motion.div>
  )
}

/** Light that follows the pointer inside a dark or glassy card. Pure CSS after the first move. */
export function Spotlight({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`spotlight ${className}`}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`)
        e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`)
      }}
    >
      {children}
    </div>
  )
}

/** Moves slower than the page while scrolling (depth). `speed` is the share of scroll it lags behind, e.g. 0.12. */
export function Parallax({ children, speed = 0.12, className = "", style }: { children: ReactNode; speed?: number; className?: string; style?: CSSProperties }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] })
  const y = useTransform(scrollYProgress, [0, 1], [`${speed * 100}%`, `${-speed * 100}%`])
  return (
    <motion.div ref={ref} className={className} style={reduce ? style : { ...style, y }}>
      {children}
    </motion.div>
  )
}

/** Image/card that opens like a curtain when scrolled into view. */
export function ClipReveal({ children, className = "", delay = 0, from = "bottom" }: { children: ReactNode; className?: string; delay?: number; from?: "bottom" | "left" }) {
  const reduce = useReducedMotion()
  const hidden = from === "left" ? "inset(0 100% 0 0 round 22px)" : "inset(100% 0 0 0 round 22px)"
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { clipPath: hidden, scale: 1.04 }}
      whileInView={{ clipPath: "inset(0% 0% 0% 0% round 0px)", scale: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 1.1, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

/** A hairline that draws itself from the left when scrolled into view. */
export function DrawLine({ className = "bg-ink", delay = 0 }: { className?: string; delay?: number }) {
  const reduce = useReducedMotion()
  return (
    <motion.span
      aria-hidden
      className={`block h-px w-full origin-left ${className}`}
      initial={reduce ? false : { scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{ duration: 1.2, delay, ease: EASE }}
    />
  )
}

/** Thin progress bar along the top edge showing how far down the page you are. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.3 })
  return <motion.div aria-hidden data-testid="scroll-progress" className="scroll-progress" style={{ scaleX }} />
}

/** Lets the hero react to the pointer: sets --px/--py (0–1) on its wrapper for CSS to use. Mouse only. */
export function PointerField({ children, className = "" }: { children: ReactNode; className?: string }) {
  const fine = useFinePointer()
  const reduce = useReducedMotion()
  const raf = useRef(0)
  return (
    <div
      className={`pointer-field ${className}`}
      onPointerMove={(e) => {
        if (!fine || reduce) return
        const el = e.currentTarget
        const { clientX, clientY } = e
        cancelAnimationFrame(raf.current)
        raf.current = requestAnimationFrame(() => {
          const r = el.getBoundingClientRect()
          el.style.setProperty("--px", ((clientX - r.left) / r.width).toFixed(3))
          el.style.setProperty("--py", ((clientY - r.top) / r.height).toFixed(3))
        })
      }}
    >
      {children}
    </div>
  )
}
