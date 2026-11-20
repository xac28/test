import React, { useState } from "react"
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Linking } from "react-native"
import { Redirect, useRouter } from "expo-router"
import { useAuth } from "../context/auth"
import { colors, API_BASE } from "../constants"

/**
 * Mobile terms gate: a signed-in user who has not accepted the current terms
 * (older accounts, Google accounts) is sent here before reaching the tabs.
 */
export default function AcceptTermsScreen() {
  const router = useRouter()
  const { user, isLoading, acceptTerms, signOut } = useAuth()
  const [checked, setChecked] = useState(false)
  const [loading, setLoading] = useState(false)

  if (isLoading) return null
  if (!user) return <Redirect href="/" />
  if (user.termsAccepted !== false) return <Redirect href="/(tabs)" />

  const onAccept = async () => {
    setLoading(true)
    const result = await acceptTerms()
    setLoading(false)
    if (result.success) {
      router.replace("/(tabs)")
    } else {
      Alert.alert("Hata", result.error || "Kabul işlemi başarısız oldu")
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Sözleşmeyi kabul edin</Text>
      <Text style={styles.body}>
        Devam etmeden önce güncel Kullanım, Pazaryeri ve Mesafeli Satış Sözleşmesi'ni onaylamanız gerekir.
      </Text>
      <View style={styles.bullets}>
        <Text style={styles.bullet}>• Dersler öğretmenin tarayıcısında kaydedilebilir; kayıt yalnızca o dersin öğretmeni ve öğrencisi tarafından indirilebilir.</Text>
        <Text style={styles.bullet}>• Kayıtlar 30 gün sonra otomatik silinir.</Text>
        <Text style={styles.bullet}>• Dersleri başka bir yöntemle kaydetmek, paylaşmak veya yayınlamak yasaktır.</Text>
      </View>

      <View style={styles.termsRow}>
        <TouchableOpacity
          testID="accept-terms-checkbox"
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          onPress={() => setChecked(!checked)}
          style={[styles.checkbox, checked && styles.checkboxChecked]}
        >
          {checked && <Text style={styles.tick}>✓</Text>}
        </TouchableOpacity>
        <Text style={styles.termsText}>
          <Text style={styles.link} onPress={() => Linking.openURL(`${API_BASE}/terms`)}>
            Kullanım, Pazaryeri ve Mesafeli Satış Sözleşmesi
          </Text>
          {" ile "}
          <Text style={styles.link} onPress={() => Linking.openURL(`${API_BASE}/privacy`)}>
            Gizlilik Politikası
          </Text>
          {"'nı okudum, kabul ediyorum."}
        </Text>
      </View>

      <TouchableOpacity
        testID="accept-terms-submit"
        style={[styles.button, (!checked || loading) && styles.disabled]}
        disabled={!checked || loading}
        onPress={onAccept}
      >
        <Text style={styles.buttonText}>{loading ? "Kaydediliyor..." : "Kabul Ediyorum ve Devam Et"}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={signOut} style={styles.decline}>
        <Text style={styles.declineText}>Kabul etmiyorum, çıkış yap</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 24, paddingTop: 80, gap: 16 },
  title: { fontFamily: "serif", fontSize: 30, color: colors.sage[900] },
  body: { fontSize: 15, color: colors.sage[700], lineHeight: 22 },
  bullets: { gap: 8 },
  bullet: { fontSize: 14, color: colors.sage[700], lineHeight: 21 },
  termsRow: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginTop: 8 },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: colors.sage[400],
    backgroundColor: colors.white, alignItems: "center", justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: colors.sage[600], borderColor: colors.sage[600] },
  tick: { color: colors.white, fontWeight: "800" },
  termsText: { flex: 1, fontSize: 14, color: colors.sage[800], lineHeight: 20 },
  link: { textDecorationLine: "underline", fontWeight: "600" },
  button: { backgroundColor: colors.sage[700], borderRadius: 50, paddingVertical: 17, alignItems: "center", marginTop: 12 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: "700" },
  disabled: { opacity: 0.5 },
  decline: { alignItems: "center", padding: 12 },
  declineText: { color: colors.sage[500], textDecorationLine: "underline" },
})
