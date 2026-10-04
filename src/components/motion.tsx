"use client"

import dynamic from "next/dynamic"
import { ReactNode, useEffect, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"

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
export function Aurora({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <div className="aurora-blob aurora-a" />
      <div className="aurora-blob aurora-b" />
      <div className="aurora-blob aurora-c" />
    </div>
  )
}
