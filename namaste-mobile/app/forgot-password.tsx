import React, { useState } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native"
import { useRouter } from "expo-router"
import { api } from "../lib/api"
import { colors } from "../constants"

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  const submit = async () => {
    setError("")
    if (!email.trim()) return setError("E-posta adresini yaz.")
    setBusy(true)
    const r = await api("/api/auth/forgot", { body: { email: email.trim() } })
    setBusy(false)
    if (r.status === 429) setError("Çok fazla deneme yaptın. Birkaç dakika sonra tekrar dene.")
    else if (!r.ok) setError(r.data?.error || "Bir sorun oluştu, tekrar dene.")
    else setSent(true)
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} style={s.back}><Text style={s.backText}>← Geri</Text></TouchableOpacity>
        {sent ? (
          <View style={s.card}>
            <Text style={s.emoji}>📬</Text>
            <Text style={s.title}>E-postanı kontrol et</Text>
            <Text style={s.text}>{email.trim()} adresiyle bir hesap varsa, şifreni sıfırlaman için bir bağlantı gönderdik. Bağlantı 1 saat geçerlidir; telefonundan ya da bilgisayarından açabilirsin. Gelmediyse spam klasörüne de bak.</Text>
            <TouchableOpacity onPress={() => router.replace("/login")} style={s.btn}><Text style={s.btnText}>Girişe dön</Text></TouchableOpacity>
          </View>
        ) : (
          <View style={s.card}>
            <Text style={s.title}>Şifreni mi unuttun?</Text>
            <Text style={s.text}>E-posta adresini yaz; sana şifreni sıfırlaman için bir bağlantı gönderelim.</Text>
            <TextInput value={email} onChangeText={setEmail} placeholder="E-posta adresi" placeholderTextColor={colors.sage[400]} autoCapitalize="none" keyboardType="email-address" autoComplete="email" style={s.input} onSubmitEditing={submit} returnKeyType="send" />
            {!!error && <Text style={s.error} accessibilityRole="alert">{error}</Text>}
            <TouchableOpacity onPress={submit} disabled={busy} style={[s.btn, busy && { opacity: 0.6 }]}>{busy ? <ActivityIndicator color={colors.white} /> : <Text style={s.btnText}>Sıfırlama bağlantısı gönder</Text>}</TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 60 },
  back: { minHeight: 48, justifyContent: "center", marginBottom: 12 },
  backText: { color: colors.sage[700], fontWeight: "600", fontSize: 15 },
  card: { backgroundColor: colors.paper, borderRadius: 24, borderWidth: 1, borderColor: colors.rule, padding: 24, gap: 14 },
  emoji: { fontSize: 44, textAlign: "center" },
  title: { fontFamily: "serif", fontSize: 30, color: colors.ink },
  text: { color: colors.sage[600], fontSize: 15, lineHeight: 22 },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.rule, borderRadius: 14, paddingHorizontal: 16, minHeight: 50, color: colors.ink, fontSize: 16 },
  error: { color: colors.clay[700], backgroundColor: colors.clay[50], borderRadius: 10, padding: 10, fontSize: 14 },
  btn: { backgroundColor: colors.clay[500], minHeight: 52, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  btnText: { color: colors.white, fontWeight: "700", fontSize: 16 },
})
