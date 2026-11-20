/** The visitor's shop cart lives in the browser: [{ id, q }] under one key; a custom event tells the navbar to update. */
export interface CartEntry { id: string; q: number }
const KEY = "aya-cart"
export const CART_EVENT = "aya:cart"

export function readCart(): CartEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]")
    return Array.isArray(v) ? v.filter((e) => e && typeof e.id === "string" && Number.isInteger(e.q) && e.q > 0).slice(0, 30) : []
  } catch {
    return []
  }
}

export function writeCart(c: CartEntry[]) {
  try { localStorage.setItem(KEY, JSON.stringify(c)) } catch { /* private mode: the cart simply does not persist */ }
  window.dispatchEvent(new Event(CART_EVENT))
}

export function addToCart(id: string, q = 1, max = 20) {
  const c = readCart()
  const e = c.find((x) => x.id === id)
  if (e) e.q = Math.min(max, e.q + q)
  else c.push({ id, q: Math.min(max, q) })
  writeCart(c)
}

export const cartCount = () => readCart().reduce((n, e) => n + e.q, 0)
