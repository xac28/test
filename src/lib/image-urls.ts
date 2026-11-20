/**
 * "/uploads/posts/post-….webp" → "/uploads/posts/post-….sq.webp": the square cut that /api/upload makes for tiles
 * (lib/image-processing). Only processed uploads have one; older files fall back to the original picture.
 */
export function squareVariant(url: string | null | undefined): string | null {
  if (!url || !/^\/uploads\/(posts|products)\/[^/]+\.webp$/.test(url) || url.endsWith(".sq.webp")) return null
  return url.replace(/\.webp$/, ".sq.webp")
}
