/**
 * Photography used across the site. Each entry is a list of sources tried in order, so you can drop your
 * own file into `public/photos/` (e.g. public/photos/hero.jpg) and it is used before the stock photo;
 * if no source loads the page falls back to an animated gradient and stays beautiful.
 */
const u = (id: string, w = 2000) => `https://images.unsplash.com/${id}?q=80&w=${w}&auto=format&fit=crop`

export const PHOTOS = {
  hero: ["/photos/hero.jpg", u("photo-1544367567-0f2fcb009e0b")],
  meditation: ["/photos/meditation.jpg", u("photo-1506126613408-eca07ce68773")],
  studio: ["/photos/studio.jpg", u("photo-1545205597-3d9d02c29597")],
  join: ["/photos/join.jpg", u("photo-1599901860904-17e6ed7083a0")],
  breath: ["/photos/breath.jpg", u("photo-1518611012118-696072aa579a")],
} as const
