import React, { useState } from "react"
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, Linking,
} from "react-native"
import { useRouter } from "expo-router"
import { useAuth } from "../context/auth"
import { colors, API_BASE } from "../constants"

export default function RegisterScreen() {
  const router = useRouter()
  const { signUp } = useAuth()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert("Hata", "Tüm alanları doldur")
      return
    }
    if (password.length < 6) {
      Alert.alert("Hata", "Şifre en az 6 karakter olmalı")
      return
    }

    if (!acceptedTerms) {
      Alert.alert("Sözleşme", "Kayıt olmak için sözleşmeyi kabul etmelisiniz.")
      return
    }

    setLoading(true)
    const result = await signUp(name.trim(), email.trim(), password.trim(), acceptedTerms)
    setLoading(false)

    if (result.success) {
      router.replace("/(tabs)")
    } else {
      Alert.alert("Kayıt başarısız", result.error || "Bir şeyler ters gitti")
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />

        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>🌱</Text>
          </View>
          <Text style={styles.brand}>AYA</Text>
          <Text style={styles.tagline}>Yolculuğuna başla</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Hesap oluştur</Text>
          <Text style={styles.cardSubtitle}>Dünya çapındaki yoga topluluğumuza katıl</Text>

          <View style={styles.form}>
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Ad soyad</Text>
              <View style={[styles.inputContainer, focusedField === "name" && styles.inputFocused]}>
                <Text style={styles.inputIcon}>👤</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Adın"
                  placeholderTextColor={colors.sage[300]}
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setFocusedField("name")}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.label}>E-posta</Text>
              <View style={[styles.inputContainer, focusedField === "email" && styles.inputFocused]}>
                <Text style={styles.inputIcon}>📧</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.sage[300]}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Şifre</Text>
              <View style={[styles.inputContainer, focusedField === "password" && styles.inputFocused]}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  style={styles.input}
                  placeholder="En az 6 karakter"
                  placeholderTextColor={colors.sage[300]}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            <View style={styles.termsRow}>
              <TouchableOpacity
                testID="register-accept-terms"
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acceptedTerms }}
                onPress={() => setAcceptedTerms(!acceptedTerms)}
                style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {acceptedTerms && <Text style={styles.checkboxTick}>✓</Text>}
              </TouchableOpacity>
              <Text style={styles.termsText}>
                <Text style={styles.termsLink} onPress={() => Linking.openURL(`${API_BASE}/terms`)}>
                  Kullanım, Pazaryeri ve Mesafeli Satış Sözleşmesi
                </Text>
                {" ile "}
                <Text style={styles.termsLink} onPress={() => Linking.openURL(`${API_BASE}/privacy`)}>
                  Gizlilik Politikası
                </Text>
                {"'nı okudum, kabul ediyorum."}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.button, (loading || !acceptedTerms) && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading || !acceptedTerms}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>{loading ? "Hesap oluşturuluyor…" : "Create Account"}</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity onPress={() => router.push("/login")} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Zaten hesabım var, giriş yap</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.footer}>
          By creating an account, you agree to our{"\n"}Terms of Service and Privacy Policy.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 40 },
  decorCircle1: {
    position: "absolute", top: -60, right: -40, width: 200, height: 200,
    borderRadius: 100, backgroundColor: colors.clay[100], opacity: 0.4,
  },
  decorCircle2: {
    position: "absolute", bottom: -40, left: -60, width: 160, height: 160,
    borderRadius: 80, backgroundColor: colors.sage[100], opacity: 0.4,
  },
  header: { alignItems: "center", marginBottom: 32 },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.sage[100],
    justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: colors.sage[200], marginBottom: 16,
  },
  logoEmoji: { fontSize: 32 },
  brand: { fontFamily: "serif", fontSize: 38, letterSpacing: 10, color: colors.sage[900], marginBottom: 8 },
  tagline: { fontSize: 15, color: colors.sage[500], letterSpacing: 0.5 },
  card: {
    backgroundColor: colors.white, borderRadius: 28, padding: 28,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 24, elevation: 4,
    borderWidth: 1, borderColor: colors.sage[100],
  },
  cardTitle: { fontSize: 24, fontFamily: "serif", color: colors.sage[900], textAlign: "center", marginBottom: 4 },
  cardSubtitle: { fontSize: 14, color: colors.sage[500], textAlign: "center", marginBottom: 28 },
  form: { gap: 18 },
  inputWrapper: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: colors.sage[800], letterSpacing: 0.5, textTransform: "uppercase" },
  inputContainer: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.sage[50],
    borderWidth: 1.5, borderColor: colors.sage[200], borderRadius: 16, paddingHorizontal: 16, gap: 10,
  },
  inputFocused: {
    borderColor: colors.sage[500], backgroundColor: colors.white,
    shadowColor: colors.sage[600], shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 2,
  },
  inputIcon: { fontSize: 18 },
  input: { flex: 1, paddingVertical: 16, fontSize: 16, color: colors.ink },
  button: {
    backgroundColor: colors.sage[600], borderRadius: 50, paddingVertical: 18, alignItems: "center", marginTop: 8,
    shadowColor: colors.sage[900], shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 6,
  },
  buttonDisabled: { opacity: 0.6 },
  termsRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.sage[400],
    backgroundColor: colors.white, alignItems: "center", justifyContent: "center", marginTop: 1,
  },
  checkboxChecked: { backgroundColor: colors.sage[600], borderColor: colors.sage[600] },
  checkboxTick: { color: colors.white, fontSize: 14, fontWeight: "800" },
  termsText: { flex: 1, fontSize: 13, color: colors.sage[700], lineHeight: 19 },
  termsLink: { color: colors.sage[800], textDecorationLine: "underline", fontWeight: "600" },
  buttonText: { color: colors.white, fontSize: 17, fontWeight: "700", letterSpacing: 0.5 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.sage[200] },
  dividerText: { fontSize: 13, color: colors.sage[400], fontWeight: "500" },
  secondaryBtn: {
    borderWidth: 1.5, borderColor: colors.sage[300], borderRadius: 50, paddingVertical: 16, alignItems: "center",
  },
  secondaryBtnText: { color: colors.sage[700], fontSize: 16, fontWeight: "600" },
  footer: { textAlign: "center", fontSize: 12, color: colors.sage[400], marginTop: 24, lineHeight: 18 },
})
