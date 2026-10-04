/** Human-readable (Turkish) names for audit-log action codes; unknown codes are shown as they are. */
const EXACT: Record<string, string> = {
  BAN_USER: "Kullanıcı yasaklandı", UNBAN_USER: "Yasak kaldırıldı", WARN_USER: "Uyarı gönderildi", MANUAL_IP_BAN: "IP engellendi", REMOVE_IP_BAN: "IP engeli kaldırıldı",
  CLOSE_ROOM: "Yayın kapatıldı", TIMEOUT_ROOM: "Sohbet kısıtlandı", CANCEL_BOOKING: "Rezervasyon iptal", DELETE_RECORDING: "Ders kaydı silindi", UNPUBLISH_WORKSHOP: "Atölye yayından kaldırıldı",
  REMOVE_POST: "Fotoğraf kaldırıldı", REMOVE_COMMENT: "Yorum kaldırıldı", REMOVE_CONTENT: "İçerik kaldırıldı (rapor)", UNMUTE_USER: "Susturma kaldırıldı",
  BLOCKED_WORD_ADD: "Yasaklı kelime eklendi", BLOCKED_WORD_REMOVE: "Yasaklı kelime silindi",
  AI_TEACH: "Rehbere cevap öğretildi", AI_TAUGHT_EDIT: "Öğretilen cevap düzenlendi", AI_TAUGHT_DELETE: "Öğretilen cevap silindi", AI_DISMISS: "Rehber sorusu yoksayıldı",
  REPORT_BULK: "Toplu rapor işlemi", REPORT_ESCALATED: "Rapor acile yükseldi", REPORT_UPDATE: "Rapor güncellendi",
  SUPPORT_REPLY: "Destek yanıtı", SUPPORT_NOTE: "Destek iç notu", SUPPORT_CLOSE: "Destek kapatıldı", SUPPORT_REOPEN: "Destek yeniden açıldı", SUPPORT_ASSIGN: "Destek üstlenildi", SUPPORT_UNASSIGN: "Destek devredildi", SUPPORT_PRIORITY: "Destek önceliği",
  POST_APPROVE: "Fotoğraf onaylandı", POST_REJECT: "Fotoğraf reddedildi", POST_REMOVE: "Fotoğraf kaldırıldı", POST_RESTORE: "Fotoğraf geri yüklendi",
  COMMENT_REMOVE: "Yorum kaldırıldı", COMMENT_RESTORE: "Yorum geri yüklendi", REVIEW_REMOVE: "Değerlendirme kaldırıldı", REVIEW_RESTORE: "Değerlendirme geri yüklendi",
}
const PREFIX: [string, string][] = [["REPORT_", "Rapor işlemi"], ["PAYOUT_", "Ödeme talebi"], ["TRIAL_", "Deneme odası"]]

export function auditLabel(action: string): string {
  if (EXACT[action]) return EXACT[action]
  const p = PREFIX.find(([k]) => action.startsWith(k))
  return p ? `${p[1]}: ${action.slice(p[0].length).toLowerCase().replace(/_/g, " ")}` : action
}
