/** Turkish date helpers for the panels (always Istanbul time, so the server and the browser agree). */
const TZ = "Europe/Istanbul"

export const fmtDay = (d: Date | string) =>
  new Date(d).toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ })
export const fmtDayShort = (d: Date | string) =>
  new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "short", timeZone: TZ })
export const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: TZ })
export const fmtTime = (d: Date | string) =>
  new Date(d).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: TZ })

/** "şimdi" / "25 dk sonra" / "3 sa 10 dk sonra" / "2 gün sonra" */
export function untilTr(target: Date | string, now = new Date()): string {
  const min = Math.round((new Date(target).getTime() - now.getTime()) / 60_000)
  if (min <= 0) return "şimdi"
  if (min < 60) return `${min} dk sonra`
  if (min < 24 * 60) {
    const h = Math.floor(min / 60), m = min % 60
    return m ? `${h} sa ${m} dk sonra` : `${h} sa sonra`
  }
  const days = Math.floor(min / (24 * 60))
  return days === 1 ? "yarın" : `${days} gün sonra`
}

export function greetingTr(now = new Date()): string {
  const h = Number(new Date(now).toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: TZ }))
  if (h < 5) return "İyi geceler"
  if (h < 12) return "Günaydın"
  if (h < 18) return "İyi günler"
  return "İyi akşamlar"
}

export const firstName = (name?: string | null) => (name || "").trim().split(/\s+/)[0] || ""
