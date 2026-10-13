const TR_MAP: Record<string, string> = {
  ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", İ: "i", I: "i", ö: "o", Ö: "o", ş: "s", Ş: "s", ü: "u", Ü: "u",
}

/** URL slug with Turkish transliteration: "Sabah Yogası: Güneşe Selam" → "sabah-yogasi-gunese-selam". */
export function slugify(input: string, maxLen = 70): string {
  const mapped = Array.from(input.normalize("NFC"))
    .map((c) => TR_MAP[c] ?? c)
    .join("")
  return (
    mapped
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, maxLen)
      .replace(/-+$/g, "") || "icerik"
  )
}

/** Slug plus a short random suffix so two items with the same title never collide. */
export function uniqueSlug(title: string): string {
  return `${slugify(title, 60)}-${Math.random().toString(36).slice(2, 7)}`
}
