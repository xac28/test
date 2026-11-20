import React, { useEffect, useState } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Share, Modal, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native"
import { api } from "../lib/api"
import { colors } from "../constants"

/** E-mail verification reminder, "download my data" and "delete my account" for the profile screen. */
export function AccountCard({ token, onDeleted }: { token: string | null; onDeleted: () => void }) {
  const [verified, setVerified] = useState<boolean | null>(null)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [info, setInfo] = useState<{ blockers: string[]; needsPassword: boolean; phrase: string } | null>(null)
  const [password, setPassword] = useState("")
  const [phrase, setPhrase] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!token) return
    api("/api/auth/verify", { token }).then((r) => { if (r.ok) setVerified(!!r.data.verified) })
  }, [token])

  const resend = async () => {
    setBusy(true)
    const r = await api("/api/auth/verify", { token, body: { resend: true } })
    setBusy(false)
    setNote(r.ok ? "Doğrulama bağlantısı e-postana gönderildi." : r.data?.error || "Gönderilemedi.")
    if (r.ok && r.data.alreadyVerified) setVerified(true)
  }

  const exportData = async () => {
    setBusy(true)
    const r = await api("/api/profile/export", { token })
    setBusy(false)
    if (!r.ok) return Alert.alert("Hata", r.data?.error || "Veriler alınamadı")
    // the system share sheet lets the person save or send the JSON wherever they like
    await Share.share({ title: "AYA verilerim", message: JSON.stringify(r.data, null, 2) })
  }

  const openDelete = async () => {
    setOpen(true)
    setError("")
    const r = await api("/api/profile/account", { token })
    if (r.ok) setInfo(r.data)
    else setError(r.data?.error || "Bilgiler alınamadı")
  }

  const remove = async () => {
    setBusy(true)
    setError("")
    const r = await api("/api/profile/account", { token, method: "DELETE", body: { confirm: phrase, password } })
    setBusy(false)
    if (r.ok) { setOpen(false); onDeleted(); return }
    if (r.data?.blockers) setInfo((i) => (i ? { ...i, blockers: r.data.blockers } : i))
    setError(r.data?.error || "Hesap silinemedi")
  }

  const blocked = (info?.blockers.length ?? 0) > 0
  const ready = !!info && !blocked && phrase === info.phrase && (!info.needsPassword || password.length > 0)

  return (
    <View style={s.card}>
      <Text style={s.title}>Hesap ve veriler</Text>

      {verified === false && (
        <View style={s.notice}>
          <Text style={s.noticeText}>E-posta adresini henüz doğrulamadın. Gelen kutundaki bağlantıya dokun; gelmediyse yeniden gönderebilirsin.</Text>
          <TouchableOpacity onPress={resend} disabled={busy} style={s.link}><Text style={s.linkText}>Bağlantıyı yeniden gönder</Text></TouchableOpacity>
          {!!note && <Text style={s.small}>{note}</Text>}
        </View>
      )}

      <TouchableOpacity onPress={exportData} disabled={busy} style={s.btn} accessibilityRole="button">
        {busy ? <ActivityIndicator color={colors.white} /> : <Text style={s.btnText}>Verilerimi indir / paylaş</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={openDelete} style={s.dangerLink} accessibilityRole="button"><Text style={s.dangerText}>Hesabımı sil</Text></TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView style={s.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={s.sheet} keyboardShouldPersistTaps="handled">
            <Text style={s.sheetTitle}>Hesabı kalıcı olarak sil</Text>
            <Text style={s.sheetText}>Profilin, paylaşımların, yorumların ve bildirimlerin silinir; bu işlem geri alınamaz. Ders ve ödeme kayıtları, adın silinmiş olarak yasal saklama için tutulur.</Text>
            {!info && !error && <ActivityIndicator color={colors.teal[600]} />}
            {blocked && info!.blockers.map((b) => <Text key={b} style={s.blocker}>• {b}</Text>)}
            {info && !blocked && (
              <View style={{ gap: 10 }}>
                {info.needsPassword && <TextInput value={password} onChangeText={setPassword} placeholder="Şifren" placeholderTextColor={colors.sage[400]} secureTextEntry autoCapitalize="none" style={s.input} />}
                <TextInput value={phrase} onChangeText={setPhrase} placeholder={`Onaylamak için "${info.phrase}" yaz`} placeholderTextColor={colors.sage[400]} autoCapitalize="characters" style={s.input} />
              </View>
            )}
            {!!error && <Text style={s.error} accessibilityRole="alert">{error}</Text>}
            <TouchableOpacity onPress={remove} disabled={!ready || busy} style={[s.delBtn, (!ready || busy) && { opacity: 0.45 }]}>{busy ? <ActivityIndicator color={colors.white} /> : <Text style={s.btnText}>Hesabımı kalıcı olarak sil</Text>}</TouchableOpacity>
            <TouchableOpacity onPress={() => setOpen(false)} style={s.cancel}><Text style={s.linkText}>Vazgeç</Text></TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.paper, borderRadius: 20, borderWidth: 1, borderColor: colors.rule, padding: 20, gap: 12, marginTop: 24, marginBottom: 32 },
  title: { fontFamily: "serif", fontSize: 22, color: colors.ink },
  notice: { backgroundColor: colors.saffron[100], borderWidth: 1, borderColor: colors.saffron[300], borderRadius: 14, padding: 14, gap: 6 },
  noticeText: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  small: { color: colors.sage[600], fontSize: 12 },
  link: { minHeight: 44, justifyContent: "center" },
  linkText: { color: colors.teal[700], fontWeight: "600", textDecorationLine: "underline" },
  btn: { backgroundColor: colors.teal[700], minHeight: 50, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  btnText: { color: colors.white, fontWeight: "700", fontSize: 15 },
  dangerLink: { minHeight: 44, justifyContent: "center", alignItems: "center" },
  dangerText: { color: colors.clay[700], fontWeight: "600" },
  backdrop: { flex: 1, backgroundColor: "rgba(18,39,43,0.55)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.cream, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 14 },
  sheetTitle: { fontFamily: "serif", fontSize: 26, color: colors.ink },
  sheetText: { color: colors.sage[700], fontSize: 14, lineHeight: 21 },
  blocker: { color: colors.clay[700], fontSize: 14, lineHeight: 20 },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.rule, borderRadius: 14, paddingHorizontal: 16, minHeight: 50, color: colors.ink, fontSize: 16 },
  error: { color: colors.clay[700], backgroundColor: colors.clay[50], borderRadius: 10, padding: 10, fontSize: 14 },
  delBtn: { backgroundColor: colors.clay[600], minHeight: 52, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  cancel: { minHeight: 48, alignItems: "center", justifyContent: "center" },
})
