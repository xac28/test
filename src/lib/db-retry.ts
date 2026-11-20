/**
 * MariaDB ≥ 11.6 (snapshot isolation on by default) aborts a statement or transaction whose row another request just
 * changed (error 1020), and InnoDB can pick a deadlock victim (1213). Both are safe to run again.
 */
export function isWriteConflict(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null
  if (err?.code === "P2034") return true
  return /code: (1020|1213)\b|Record has changed since last read|deadlock/i.test(String(err?.message ?? ""))
}

export async function withConflictRetry<T>(run: () => Promise<T>, attempts = 6): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run()
    } catch (e) {
      if (!isWriteConflict(e) || attempt >= attempts) throw e
      await new Promise((r) => setTimeout(r, 15 + Math.random() * 40 * (attempt + 1)))
    }
  }
}
