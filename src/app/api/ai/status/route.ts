import { NextResponse } from "next/server"
import { aiEnabled } from "@/lib/ai/config"
import { withinBudget } from "@/lib/ai/usage"

export const dynamic = "force-dynamic"

// GET /api/ai/status → { enabled } : whether the chat widget should talk to the AI or to the rule-based guide
export async function GET() {
  return NextResponse.json({ enabled: aiEnabled() && (await withinBudget()) })
}
