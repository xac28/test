/** Public address of the site (canonical links, sitemap, social cards). Set NEXT_PUBLIC_SITE_URL in production. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/+$/, "")
export const SITE_NAME = "AYA"
export const SITE_DESCRIPTION = "AYA: canlı dersler ve atölyeler, podcast, topluluk ve wellness mağazası tek yerde. Yoga, nefes ve meditasyon üzerine sertifikalı eğitmenlerle."
