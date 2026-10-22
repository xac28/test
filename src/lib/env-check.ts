/** Misconfigurations that are fine on a laptop and dangerous in production. Pure function: easy to test. */
export function envProblems(env: Record<string, string | undefined>): string[] {
  const out: string[] = []
  const weak = (v: string | undefined) => !v || /^(change-me|secret|build|test|dummy|password)$/i.test(v) || v.length < 16
  if (weak(env.AUTH_SECRET)) out.push("AUTH_SECRET is missing or weak (use `openssl rand -base64 32`): sessions can be forged.")
  if (weak(env.CRON_SECRET)) out.push("CRON_SECRET is missing or weak: /api/cron/* is guessable.")
  if (!env.NEXT_PUBLIC_SITE_URL || /localhost|127\.0\.0\.1/.test(env.NEXT_PUBLIC_SITE_URL)) out.push("NEXT_PUBLIC_SITE_URL points at localhost: canonical links, sitemap and e-mail links will be wrong.")
  if (env.NEXTAUTH_URL && !/^https:/.test(env.NEXTAUTH_URL)) out.push("NEXTAUTH_URL is not https: cookies cannot be marked secure.")
  if (!env.SMTP_USER || !env.SMTP_PASS) out.push("SMTP_USER/SMTP_PASS are not set: password-reset and verification e-mails cannot be sent.")
  if (!env.STRIPE_SECRET_KEY || /dummy/.test(env.STRIPE_SECRET_KEY)) out.push("STRIPE_SECRET_KEY is a placeholder: card payments will fail (Iyzico may still work).")
  if (env.LIVEKIT_API_KEY === "devkey" || env.LIVEKIT_API_SECRET === "secret") out.push("LiveKit still uses the development key pair (devkey/secret).")
  if (env.LIVEKIT_URL && /^ws:/.test(env.LIVEKIT_URL) && !/localhost|127\.0\.0\.1/.test(env.LIVEKIT_URL)) out.push("LIVEKIT_URL is ws:// on a public host: browsers on https pages need wss://.")
  return out
}
