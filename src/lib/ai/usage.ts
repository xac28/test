import { db } from "@/lib/db"
import { AI_LIMITS } from "@/lib/ai/config"

export const dayKey = (d = new Date()) => d.toISOString().slice(0, 10)

/** False once today's token budget is spent (or when the ledger cannot be read: then the safe, free path is used). */
export async function withinBudget(): Promise<boolean> {
  try {
    const row = await db.aiUsageDay.findUnique({ where: { day: dayKey() } })
    return !row || row.inputTokens + row.outputTokens < AI_LIMITS.dailyTokenBudget
  } catch {
    return false
  }
}

export async function recordUsage(u: { inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; request?: boolean; fallback?: boolean }) {
  const inc = { requests: u.request ? 1 : 0, inputTokens: u.inputTokens ?? 0, outputTokens: u.outputTokens ?? 0, cacheReadTokens: u.cacheReadTokens ?? 0, fallbacks: u.fallback ? 1 : 0 }
  try {
    await db.aiUsageDay.upsert({
      where: { day: dayKey() },
      create: { day: dayKey(), ...inc },
      update: { requests: { increment: inc.requests }, inputTokens: { increment: inc.inputTokens }, outputTokens: { increment: inc.outputTokens }, cacheReadTokens: { increment: inc.cacheReadTokens }, fallbacks: { increment: inc.fallbacks } },
    })
  } catch (e) {
    console.error("[AI_USAGE]", e)
  }
}
