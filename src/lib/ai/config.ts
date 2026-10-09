import Anthropic from "@anthropic-ai/sdk"

/** The model behind the guide. Set AYA_AI_MODEL to move to a cheaper or newer one without touching code. */
export const AI_MODEL = () => process.env.AYA_AI_MODEL || "claude-opus-5-5"

export const aiEnabled = () => !!process.env.ANTHROPIC_API_KEY && process.env.AYA_AI_DISABLED !== "1"

export const AI_LIMITS = {
  /** messages of history sent to the model */
  maxHistory: 16,
  maxUserChars: 800,
  maxAssistantChars: 2500,
  maxOutputTokens: 2500,
  /** model ↔ tool round trips per question */
  maxToolTurns: 5,
  /** questions per day */
  perUserDay: Number(process.env.AYA_AI_USER_DAILY || 150),
  perVisitorDay: Number(process.env.AYA_AI_VISITOR_DAILY || 40),
  /** input + output tokens per day for the whole site; when it is spent the rule-based guide takes over */
  dailyTokenBudget: Number(process.env.AYA_AI_DAILY_TOKENS || 3_000_000),
}

/** Reads the key at call time so a restarted server picks up a changed environment. */
export const makeClient = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 90_000 })
