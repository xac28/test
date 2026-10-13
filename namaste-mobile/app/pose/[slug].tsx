import React, { useEffect, useState } from "react"
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Linking } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { api } from "../../lib/api"
import { API_BASE, assetUrl, colors } from "../../constants"

export default function PoseScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  const [pose, setPose] = useState<any>(null)
  const [state, setState] = useState<"loading" | "ok" | "missing" | "error">("loading")

  useEffect(() => {
    let alive = true
    api(`/api/poses/${slug}`).then((r) => {
      if (!alive) return
      if (r.ok) { setPose(r.data); setState("ok") } else setState(r.status === 404 ? "missing" : "error")
    })
    return () => { alive = false }
  }, [slug])

  if (state !== "ok") {
    return (
      <SafeAreaView style={s.container}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}><Text style={s.backText}>← Geri</Text></TouchableOpacity>
        <View style={s.center}>
          {state === "loading" ? <ActivityIndicator color={colors.teal[600]} /> : <Text style={s.muted}>{state === "missing" ? "Bu poz bulunamadı." : "Poz yüklenemedi."}</Text>}
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} accessibilityRole="button"><Text style={s.backText}>← Geri</Text></TouchableOpacity>
        <Image source={{ uri: assetUrl(pose.image)! }} style={s.hero} resizeMode="cover" accessibilityLabel={`${pose.name} duruşu`} />
        <View style={s.body}>
          <Text style={s.eyebrow}>{pose.category.toUpperCase()} · {pose.level.toUpperCase()}</Text>
          <Text style={s.title}>{pose.name}</Text>
          <Text style={s.sanskrit}>{pose.sanskrit} · {pose.english}</Text>
          <Text style={s.lead}>{pose.intro}</Text>
          <View style={s.pills}>
            <Text style={s.pill}>⏱ {pose.hold}</Text>
            <Text style={s.pill}>🌬 {pose.breath}</Text>
          </View>

          <Text style={s.h2}>Faydaları</Text>
          {pose.benefits.map((b: string) => <Text key={b} style={s.li}>✓ {b}</Text>)}

          <Text style={s.h2}>Nasıl yapılır</Text>
          {pose.steps.map((t: string, i: number) => (
            <View key={i} style={s.step}><Text style={s.stepNo}>{i + 1}</Text><Text style={s.stepText}>{t}</Text></View>
          ))}

          <View style={[s.box, { backgroundColor: colors.teal[50], borderColor: colors.teal[200] }]}><Text style={s.boxTitle}>Daha kolay</Text><Text style={s.boxText}>{pose.easier}</Text></View>
          <View style={[s.box, { backgroundColor: colors.clay[50], borderColor: colors.clay[200] }]}><Text style={s.boxTitle}>Daha zor</Text><Text style={s.boxText}>{pose.harder}</Text></View>
          <View style={[s.box, { backgroundColor: colors.saffron[100], borderColor: colors.saffron[300] }]}>
            <Text style={s.boxTitle}>Dikkat</Text>
            {pose.avoid.map((a: string) => <Text key={a} style={s.boxText}>• {a}</Text>)}
            <Text style={[s.boxText, { fontSize: 11, marginTop: 6, color: colors.sage[500] }]}>Bu bilgi genel amaçlıdır, tıbbi tavsiye yerine geçmez; sağlık sorunun varsa önce doktoruna danış.</Text>
          </View>

          {pose.counter.length > 0 && (
            <>
              <Text style={s.h2}>Şunlarla dengele</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {pose.counter.map((c: any) => (
                  <TouchableOpacity key={c.slug} onPress={() => router.push(`/pose/${c.slug}`)} style={s.mini}>
                    <Image source={{ uri: assetUrl(c.image)! }} style={s.miniImg} />
                    <Text style={s.miniText} numberOfLines={1}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          <TouchableOpacity onPress={() => Linking.openURL(`${API_BASE}/pozlar/${pose.slug}`)} style={s.cta} accessibilityRole="link">
            <Text style={s.ctaText}>3B modeli web'de döndür</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: colors.sage[500] },
  back: { paddingHorizontal: 20, minHeight: 48, justifyContent: "center" },
  backText: { color: colors.sage[700], fontWeight: "600", fontSize: 15 },
  hero: { width: "100%", aspectRatio: 4 / 5, backgroundColor: colors.teal[100] },
  body: { padding: 20 },
  eyebrow: { color: colors.clay[600], fontSize: 11, letterSpacing: 1.5, fontWeight: "700" },
  title: { fontFamily: "serif", fontSize: 36, color: colors.ink, marginTop: 6 },
  sanskrit: { fontFamily: "serif", fontStyle: "italic", color: colors.clay[500], fontSize: 16, marginTop: 2 },
  lead: { color: colors.sage[700], fontSize: 16, lineHeight: 24, marginTop: 14 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  pill: { backgroundColor: colors.teal[50], color: colors.teal[700], paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, overflow: "hidden", fontSize: 13 },
  h2: { fontFamily: "serif", fontSize: 24, color: colors.ink, marginTop: 28, marginBottom: 10 },
  li: { color: colors.sage[700], fontSize: 15, lineHeight: 22, marginBottom: 6 },
  step: { flexDirection: "row", gap: 12, marginBottom: 12 },
  stepNo: { fontFamily: "serif", fontSize: 24, color: colors.clay[400], width: 26 },
  stepText: { flex: 1, color: colors.sage[800], fontSize: 15, lineHeight: 22 },
  box: { borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 14 },
  boxTitle: { fontFamily: "serif", fontSize: 18, color: colors.ink, marginBottom: 4 },
  boxText: { color: colors.sage[700], fontSize: 14, lineHeight: 20 },
  mini: { width: 110 },
  miniImg: { width: 110, height: 138, borderRadius: 14, backgroundColor: colors.teal[100] },
  miniText: { marginTop: 6, color: colors.ink, fontSize: 13 },
  cta: { marginTop: 32, backgroundColor: colors.clay[500], minHeight: 52, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  ctaText: { color: colors.white, fontWeight: "700", fontSize: 16 },
})
