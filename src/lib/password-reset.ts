import crypto from "crypto"
import { SITE_URL } from "@/lib/site"

export const RESET_TTL_MS = 60 * 60 * 1000 // a reset link is valid for one hour
export const RESET_COOLDOWN_MS = 60 * 1000 // one mail per minute per account

export const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex")
export const newToken = () => crypto.randomBytes(32).toString("hex")
export const resetLink = (token: string) => `${SITE_URL}/reset-password?token=${token}`

export function resetEmail(name: string | null, link: string) {
  const who = name ? ` ${name}` : ""
  return {
    subject: "AYA: şifreni sıfırla",
    text: `Merhaba${who},\n\nŞifreni sıfırlamak için bağlantıya tıkla (1 saat geçerli):\n${link}\n\nBu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; şifren değişmez.\n\nAYA`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#133663"><h2 style="font-weight:400">AYA</h2><p>Merhaba${who},</p><p>Şifreni sıfırlamak için aşağıdaki düğmeye tıkla. Bağlantı <strong>1 saat</strong> geçerlidir.</p><p><a href="${link}" style="display:inline-block;background:#2f7de1;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600">Şifremi sıfırla</a></p><p style="color:#4d6764;font-size:14px">Düğme çalışmıyorsa şu adresi tarayıcına yapıştır:<br>${link}</p><p style="color:#4d6764;font-size:14px">Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; şifren değişmez.</p></div>`,
  }
}
