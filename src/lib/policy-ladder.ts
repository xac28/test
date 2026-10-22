export const SUSPEND_DAYS = 10
export const POLICY_LADDER_TR = [
  { strike: 1, action: "Resmi uyarı", detail: "Mesaj engellenir, panelde uyarı gösterilir, e-posta gider." },
  { strike: 2, action: `${SUSPEND_DAYS} gün uzaklaştırma`, detail: "Listelerden çıkar; ders/yayın/atölye açamaz, mesaj ve paylaşım yapamaz." },
  { strike: 3, action: "Kalıcı ban", detail: "Hesap kapatılır, oturumlar sonlanır, bilinen IP'ler engellenir." },
]
