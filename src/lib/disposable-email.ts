/**
 * Stops the single most common way a sign-up form gets filled with fake data: throwaway / disposable
 * mailbox providers (Mailinator, Guerrilla Mail, 10 Minute Mail, …) that anyone can use to make an
 * address nobody — not even the person who typed it — can ever actually be reached at. No external API
 * or network call: a maintained static list, the same self-contained approach as the rest of this app
 * (no third-party dependency, no key to configure, nothing that can go down). This runs unconditionally,
 * unlike REQUIRE_EMAIL_VERIFICATION (lib/email-verification.ts) which needs SMTP configured first — so
 * it already stops most throwaway sign-ups on a brand-new install, before any mail server is set up.
 *
 * Not exhaustive — new disposable services appear constantly — so this is one layer, not the whole
 * defence: it sits alongside rate limiting (lib/rate-limit.ts) and ban-evasion detection
 * (lib/ban-engine.ts), which catch the rest (the same person retrying fast, the same IP, alias tricks).
 * An operator who spots a gap can extend the list without a code change: BLOCKED_EMAIL_DOMAINS_EXTRA
 * in .env, comma-separated.
 */

/** Domains whose mailbox is deliberately temporary/public — the provider's whole purpose. */
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "mailinator.net", "mailinator.org", "mailinator2.com", "sogetthis.com",
  "guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "guerrillamail.biz", "guerrillamail.de",
  "guerrillamailblock.com", "grr.la", "sharklasers.com", "pokemail.net", "spam4.me",
  "10minutemail.com", "10minutemail.net", "10minemail.com", "20minutemail.com", "temp-mail.org",
  "temp-mail.io", "tempmail.com", "tempmail.net", "tempmailo.com", "tempmail.dev", "tempail.com",
  "tempinbox.com", "tempinbox.co", "tmpmail.org", "tmpmail.net", "throwawaymail.com", "throwam.com",
  "dispostable.com", "trashmail.com", "trashmail.net", "trashmail.me", "trash-mail.com", "trash-mail.de",
  "wegwerfmail.de", "wegwerfmail.net", "wegwerfmail.org", "wegwerfemail.de", "spambog.com", "spambog.de",
  "spambog.ru", "mohmal.com", "mohmal.im", "mohmal.in", "mohmal.tech", "getnada.com", "nada.email",
  "dropmail.me", "mailnesia.com", "mailcatch.com", "mailnull.com", "maildrop.cc", "mailsac.com",
  "fakeinbox.com", "fakemailgenerator.com", "fakemail.net", "yopmail.com", "yopmail.fr", "yopmail.net",
  "cool.fr.nf", "jetable.fr.nf", "moakt.com", "moakt.cc", "moakt.ws", "emailondeck.com", "inboxkitten.com",
  "spamgourmet.com", "spamgourmet.net", "spamgourmet.org", "mytemp.email", "burnermail.io", "discard.email",
  "discardmail.com", "mailtemp.net", "mail-temporaire.fr", "mail-temporaire.com", "emailfake.com",
  "crazymailing.com", "mintemail.com", "mytrashmail.com", "harakirimail.com", "anonbox.net", "anonymbox.com",
  "incognitomail.com", "mailexpire.com", "spoofmail.de", "deadaddress.com", "mailimate.com", "mailforspam.com",
  "33mail.com", "mailcatch.net", "fakemailgenerator.net", "no-spam.ws", "disposablemail.com",
  "e4ward.com", "emailsensei.com", "mailme24.com", "mailme.lv", "receivemail.org", "tempemail.co",
  "tempemail.net", "tempemail.com", "tempr.email", "temporaryemail.net", "temporary-mail.net", "mailbox52.ws",
  "mailbox92.biz", "mailbox.in.ua", "letthemeatspam.com", "binkmail.com", "bobmail.info", "chammy.info",
  "devnullmail.com", "ipoo.org", "mt2015.com", "nepwk.com", "nomail.xl.cx", "nospamfor.us", "objectmail.com",
  "proxymail.eu", "rcpt.at", "s0ny.net", "sendspamhere.com", "sogetthis.co", "superrito.com",
  "sweetxxx.de", "tempemails.io", "tempmailaddress.com", "veryrealemail.com", "zoemail.org", "0-mail.com",
  "0815.ru", "0clickemail.com", "0wnd.net", "1chuan.com", "a-bc.net", "afrobacon.com", "armyspy.com",
  "cuvox.de", "dayrep.com", "einrot.com", "fleckens.hu", "gustr.com", "jourrapide.com", "rhyta.com",
  "superdada.net", "teleworm.us",
])

/** Providers where ANY subdomain works (so blocking the bare domain alone is useless): match by suffix. */
const DISPOSABLE_WILDCARD_SUFFIXES = [".mailinator.com", ".guerrillamail.com", ".sharklasers.com", ".spam4.me"]

// Re-read on every call rather than caching: this is a short env string, parsing it costs nothing
// next to the rest of a request, and it means a changed .env (or a test) takes effect immediately.
function extraDomains(): Set<string> {
  return new Set(
    (process.env.BLOCKED_EMAIL_DOMAINS_EXTRA || "")
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean)
  )
}

export function emailDomain(email: string): string {
  return email.trim().toLowerCase().split("@").pop() ?? ""
}

export function isDisposableEmailDomain(domain: string): boolean {
  const d = domain.toLowerCase()
  if (DISPOSABLE_DOMAINS.has(d) || extraDomains().has(d)) return true
  return DISPOSABLE_WILDCARD_SUFFIXES.some((suffix) => d.endsWith(suffix))
}

/**
 * Stricter than the old one-line regex (which accepted things like "a@b.c" or "a @@..b"): a real local
 * part and domain, a TLD of at least two letters, sane overall length. Still deliberately not a full
 * RFC 5322 parser — that standard allows addresses no real mail provider accepts anyway — just enough to
 * reject the obviously-fake inputs a bot or a careless form-fill produces.
 */
export function isValidEmailStrict(email: string): boolean {
  if (typeof email !== "string" || email.length < 5 || email.length > 254) return false
  const m = /^([^\s@]{1,64})@([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,24})$/i.exec(email)
  if (!m) return false
  const [, local] = m
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false
  return true
}

/** One check for every place a visitor hands us an e-mail with nothing else proving it is real: registration, the newsletter. */
export function rejectFakeEmail(email: string): string | null {
  if (!isValidEmailStrict(email)) return "Geçerli bir e-posta adresi girin."
  if (isDisposableEmailDomain(emailDomain(email))) {
    return "Geçici/tek kullanımlık e-posta servisleri kabul edilmiyor. Lütfen gerçek bir e-posta adresi kullanın."
  }
  return null
}
