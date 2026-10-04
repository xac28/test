"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { ArrowRight, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useL } from "@/components/editorial"

const SHOW_ON = ["/", "/teachers", "/atolyeler", "/icerikler", "/pricing", "/live"]
const KEY = "aya-signup-nudge"

/** A quiet bottom bar that invites visitors (not members) to join, after they have looked around a little. */
export function SignupNudge() {
  const L = useL()
  const { data: session, status } = useSession()
  const pathname = usePathname() || "/"
  const [open, setOpen] = useState(false)

  const eligible = status === "unauthenticated" && SHOW_ON.some((p) => pathname === p || (p !== "/" && pathname.startsWith(p + "/") && !pathname.startsWith("/live/")))

  useEffect(() => {
    if (!eligible) return setOpen(false)
    try {
      if (sessionStorage.getItem(KEY)) return
    } catch {}
    const onScroll = () => window.scrollY > 600 && setOpen(true)
    const timer = setTimeout(() => setOpen(true), 15_000)
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => {
      clearTimeout(timer)
      window.removeEventListener("scroll", onScroll)
    }
  }, [eligible, pathname])

  const close = () => {
    setOpen(false)
    try {
      sessionStorage.setItem(KEY, "1")
    } catch {}
  }

  if (session) return null
  return (
    <AnimatePresence>
      {open && eligible && (
        <motion.aside
          role="complementary"
          aria-label={L("Üyelik daveti", "Join invitation")}
          data-testid="signup-nudge"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 26 }}
          className="fixed z-[80] left-4 right-24 bottom-4 sm:right-auto sm:left-5 sm:bottom-5 sm:max-w-md bg-ink text-cream rounded-xl shadow-2xl p-4 pr-10 flex items-center gap-4"
        >
          <div className="min-w-0">
            <p className="font-display text-lg leading-tight">{L("Pratiğine bugün başla.", "Start your practice today.")}</p>
            <p className="text-xs text-cream/70 mt-0.5">{L("Ücretsiz üye ol; ilk deneme dersi yarı fiyat.", "Join free; your first trial lesson is half price.")}</p>
          </div>
          <Link href="/login?mode=register" onClick={close} data-testid="signup-nudge-cta" className="cta shrink-0 inline-flex items-center gap-1.5 bg-accent text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-accent-dark">
            {L("Üye ol", "Join")} <ArrowRight size={14} />
          </Link>
          <button onClick={close} aria-label={L("Kapat", "Dismiss")} className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded text-cream/60 hover:text-cream">
            <X size={14} />
          </button>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
