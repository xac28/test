import bcrypt from "bcryptjs"

/**
 * Failed-login throttle. The per-IP request limiter cannot stop a guesser who rotates addresses, so failures are
 * also counted per account (and per IP across accounts). In memory like the rest of the limiters: one instance per site.
 */
const WINDOW_MS = 15 * 60_000
export const MAX_FAILS_PER_ACCOUNT = 10
export const MAX_FAILS_PER_IP = 25

const fails = new Map<string, number[]>()

setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS
  for (const [k, v] of fails) if (!v.length || v[v.length - 1] < cutoff) fails.delete(k)
}, 60_000).unref?.()

function recent(key: string): number[] {
  const cutoff = Date.now() - WINDOW_MS
  const list = (fails.get(key) || []).filter((t) => t > cutoff)
  if (list.length) fails.set(key, list)
  else fails.delete(key)
  return list
}

const accountKey = (email: string) => `a:${email.toLowerCase()}`
const ipKey = (ip: string | null | undefined) => (ip ? `i:${ip}` : null)

/** true while this account, or this address, has too many recent failures */
export function loginLocked(email: string, ip?: string | null): boolean {
  if (recent(accountKey(email)).length >= MAX_FAILS_PER_ACCOUNT) return true
  const k = ipKey(ip)
  return !!k && recent(k).length >= MAX_FAILS_PER_IP
}

export function recordLoginFailure(email: string, ip?: string | null) {
  for (const k of [accountKey(email), ipKey(ip)]) {
    if (!k) continue
    const list = recent(k)
    list.push(Date.now())
    fails.set(k, list)
  }
}

export function clearLoginFailures(email: string) {
  fails.delete(accountKey(email))
}

export const LOGIN_LOCKED_MESSAGE = "Çok fazla başarısız deneme. Lütfen 15 dakika sonra tekrar deneyin."

// A real bcrypt hash of a random string: comparing against it costs the same as a real check, so an unknown e-mail
// cannot be told apart from a wrong password by response time.
const DUMMY_HASH = bcrypt.hashSync("aya-dummy-" + Math.random().toString(36), 12)
export async function burnPasswordCheck(password: string) {
  await bcrypt.compare(password, DUMMY_HASH)
}
