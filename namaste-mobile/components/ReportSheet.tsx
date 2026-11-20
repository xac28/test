import React, { useState } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native"
import { API_BASE, colors } from "../constants"
import { useAuth } from "../context/auth"

// Mirrors REPORT_CATEGORIES in the web app (src/lib/reports.ts) for lesson (BOOKING) reports.
const LESSON_CATEGORIES: { id: string; label: string }[] = [
  { id: "SAFETY", label: "Güvenlik / zarar riski" },
  { id: "HARASSMENT", label: "Taciz / uygunsuz davranış" },
  { id: "FRAUD", label: "Aldatma / dolandırıcılık" },
  { id: "RECORDING_VIOLATION", label: "Kayıt / paylaşım ihlali" },
  { id: "NO_SHOW", label: "Derse gelmedi / geç kaldı" },
  { id: "QUALITY", label: "Ders kalitesi" },
  { id: "TECHNICAL", label: "Teknik sorun" },
  { id: "OTHER", label: "Diğer" },
]

const MIN_LEN = 10

/** Bottom sheet to report a lesson. The server decides who is reported; the reporter stays anonymous to them. */
export function ReportSheet({ visible, bookingId, onClose }: { visible: boolean; bookingId: string; onClose: () => void }) {
  const { token } = useAuth()
  const [category, setCategory] = useState("")
  const [description, setDescription] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const close = () => {
    setCategory("")
    setDescription("")
    setError(null)
    setDone(false)
    onClose()
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetType: "BOOKING", targetId: bookingId, category, description }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setError(data.error || "Bildirim gönderilemedi.")
      else setDone(true)
    } catch {
      setError("Ağ hatası, lütfen tekrar deneyin.")
    } finally {
      setBusy(false)
    }
  }

  const canSend = !!category && description.trim().length >= MIN_LEN && !busy

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.backdrop}>
        <View style={styles.sheet}>
          {done ? (
            <View style={styles.center}>
              <Text style={styles.doneIcon}>✓</Text>
              <Text style={styles.title}>Bildiriminiz alındı</Text>
              <Text style={styles.muted}>Yöneticilerimiz inceleyecek. Bildirdiğiniz kişi sizin kimliğinizi görmez.</Text>
              <TouchableOpacity style={styles.primary} onPress={close}>
                <Text style={styles.primaryText}>Tamam</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.title}>Bu dersi bildir</Text>
              <Text style={styles.label}>NEDEN BİLDİRİYORSUNUZ?</Text>
              {LESSON_CATEGORIES.map((c) => (
                <TouchableOpacity key={c.id} onPress={() => setCategory(c.id)} style={[styles.option, category === c.id && styles.optionActive]}>
                  <View style={[styles.radio, category === c.id && styles.radioActive]} />
                  <Text style={styles.optionText}>{c.label}</Text>
                </TouchableOpacity>
              ))}
              <Text style={[styles.label, { marginTop: 16 }]}>NE OLDU?</Text>
              <TextInput
                value={description}
                onChangeText={(t) => setDescription(t.slice(0, 1500))}
                multiline
                placeholder="Durumu kısaca anlatın: ne zaman, ne oldu?"
                placeholderTextColor={colors.sage[400]}
                style={styles.input}
              />
              {error && <Text style={styles.error}>{error}</Text>}
              <View style={styles.row}>
                <TouchableOpacity style={styles.secondary} onPress={close}>
                  <Text style={styles.secondaryText}>Vazgeç</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primary, !canSend && { opacity: 0.4 }]} disabled={!canSend} onPress={submit}>
                  {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>Gönder</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { maxHeight: "90%", backgroundColor: "#18211d", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  center: { alignItems: "center", gap: 12, paddingVertical: 12 },
  title: { fontFamily: "serif", fontSize: 24, color: colors.white, marginBottom: 12 },
  doneIcon: { fontSize: 44, color: "#4ade80" },
  muted: { color: colors.sage[400], textAlign: "center", lineHeight: 20 },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 1.5, color: colors.sage[400], marginBottom: 8 },
  option: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", marginBottom: 6 },
  optionActive: { borderColor: colors.sage[500], backgroundColor: "rgba(106,138,86,0.15)" },
  optionText: { color: colors.white, fontSize: 15 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.sage[500] },
  radioActive: { backgroundColor: colors.sage[500] },
  input: { minHeight: 96, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", color: colors.white, padding: 12, textAlignVertical: "top" },
  error: { color: "#f87171", marginTop: 10 },
  row: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 18 },
  primary: { backgroundColor: colors.sage[600], paddingHorizontal: 28, paddingVertical: 14, borderRadius: 50, alignItems: "center", minWidth: 110 },
  primaryText: { color: colors.white, fontWeight: "700", fontSize: 16 },
  secondary: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 50, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  secondaryText: { color: colors.white, fontSize: 16 },
})
