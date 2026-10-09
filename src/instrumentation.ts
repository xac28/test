// Runs once when the server starts. In production it prints configuration problems (it never refuses to start).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return
  const { envProblems } = await import("@/lib/env-check")
  const problems = envProblems(process.env)
  if (problems.length) {
    console.warn(`[AYA] ${problems.length} configuration warning(s):\n - ${problems.join("\n - ")}`)
  } else {
    console.log("[AYA] configuration looks production-ready")
  }
}
