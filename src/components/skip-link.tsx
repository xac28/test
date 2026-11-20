"use client"

/** First tab stop on every page: lets keyboard and screen-reader users jump over the navigation. */
export function SkipLink() {
  return (
    <a
      href="#icerik"
      onClick={(e) => {
        e.preventDefault()
        const main = document.querySelector("main")
        if (!main) return
        main.setAttribute("tabindex", "-1")
        main.focus()
        main.scrollIntoView()
      }}
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:bg-ink focus:text-cream focus:px-4 focus:py-2.5 focus:rounded-full focus:text-sm focus:font-semibold focus:shadow-lg"
    >
      İçeriğe geç
    </a>
  )
}
