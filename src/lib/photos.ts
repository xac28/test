/**
 * Photography used across the site. Each entry is a list of sources tried in order, so you can drop your
 * own file into `public/photos/` (e.g. public/photos/hero.jpg) and it is used before the stock photo;
 * if no source loads the page falls back to an animated gradient and stays beautiful.
 * Where every photo (and pose picture) comes from, and under which licence: PHOTO_CREDITS.md.
 */
const u = (id: string, w = 2000) => `https://images.unsplash.com/${id}?q=80&w=${w}&auto=format&fit=crop`

/**
 * Bump when a file under public/photos or public/poses is replaced: the new URL makes every browser fetch the
 * new picture instead of showing the one it kept from before.
 */
export const PHOTO_VERSION = "2"
const local = (path: string) => `${path}?v=${PHOTO_VERSION}`

export const PHOTOS = {
  hero: [local("/photos/hero.jpg"), u("photo-1544367567-0f2fcb009e0b")],
  meditation: [local("/photos/meditation.jpg"), u("photo-1506126613408-eca07ce68773")],
  studio: [local("/photos/studio.jpg"), u("photo-1545205597-3d9d02c29597")],
  join: [local("/photos/join.jpg"), u("photo-1599901860904-17e6ed7083a0")],
  breath: [local("/photos/breath.jpg"), u("photo-1767611038549-7cdfeb77bdd8")],
} as const

/** Landscape studio shots (3:2) for cards whose workshop / article / episode has no picture of its own. */
const COVER = {
  akis: local("/photos/covers/akis.jpg"),
  cocuk: local("/photos/covers/cocuk.jpg"),
  dag: local("/photos/covers/dag.jpg"),
  kayik: local("/photos/covers/kayik.jpg"),
  kopru: local("/photos/covers/kopru.jpg"),
  savasana: local("/photos/covers/savasana.jpg"),
  savasci: local("/photos/covers/savasci.jpg"),
  agac: local("/photos/covers/agac.jpg"),
  ayaktaYukari: local("/photos/covers/ayakta-yukari-uzanis.jpg"),
  deve: local("/photos/covers/deve.jpg"),
  malasana: local("/photos/covers/malasana.jpg"),
  oneEgilme: local("/photos/covers/one-egilme.jpg"),
  sandalye: local("/photos/covers/sandalye.jpg"),
  savasci1: local("/photos/covers/savasci-1.jpg"),
  sfenks: local("/photos/covers/sfenks.jpg"),
  ucgen: local("/photos/covers/ucgen.jpg"),
  studio: PHOTOS.studio[0],
  join: PHOTOS.join[0],
  hero: PHOTOS.hero[0],
  breath: PHOTOS.breath[0],
  meditation: PHOTOS.meditation[0],
}

// topics never share a picture, so two cards of different topics side by side never look the same; each
// pool is deliberately a handful of photos (not one or two) so the same category doesn't repeat either
const POOLS: { match: RegExp; photos: string[] }[] = [
  { match: /nefes|pranayama|breath/i, photos: [COVER.breath, COVER.sfenks, COVER.dag] },
  { match: /meditasyon|nidra|uyku|mindful|farkındalık|meditation|podcast/i, photos: [COVER.meditation, COVER.hero, COVER.sfenks] },
  { match: /yin|restoratif|restorative|gevşe|esneklik|bakım|hamile|prenatal/i, photos: [COVER.cocuk, COVER.kopru, COVER.savasana, COVER.oneEgilme] },
  { match: /sağlık|felsefe|kişisel gelişim|beslenme/i, photos: [COVER.join, COVER.kayik, COVER.malasana] },
]
const GENERAL = [COVER.studio, COVER.akis, COVER.savasci, COVER.agac, COVER.ayaktaYukari, COVER.deve, COVER.sandalye, COVER.savasci1, COVER.ucgen]

/**
 * A real photo for something that has no picture of its own, chosen by its topic (category) and spread by
 * its title so neighbouring cards differ. Always the same photo for the same item.
 */
export function topicPhoto(title: string, topic?: string | null): string {
  const pool = POOLS.find((p) => p.match.test(`${topic ?? ""} ${title}`))?.photos ?? GENERAL
  const n = Array.from(title || "·").reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
  return pool[n % pool.length]
}
