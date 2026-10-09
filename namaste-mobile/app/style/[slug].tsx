import React, { useEffect, useState } from "react"
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { api } from "../../lib/api"
import { assetUrl, colors } from "../../constants"

export default function StyleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  const [st, setSt] = useState<any>(null)
  const [state, setState] = useState<"loading" | "ok" | "missing" | "error">("loading")

  useEffect(() => {
    let alive = true
    api(`/api/styles/${slug}`).then((r) => {
      if (!alive) return
      if (r.ok) { setSt(r.data); setState("ok") } else setState(r.status === 404 ? "missing" : "error")
    })
    return () => { alive = false }
  }, [slug])

  if (state !== "ok") {
    return (
      <SafeAreaView style={s.container}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}><Text style={s.backText}>← Geri</Text></TouchableOpacity>
        <View style={s.center}>{state === "loading" ? <ActivityIndicator color={colors.teal[600]} /> : <Text style={s.muted}>{state === "missing" ? "Bu stil bulunamadı." : "Stil yüklenemedi."}</Text>}</View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} accessibilityRole="button"><Text style={s.backText}>← Geri</Text></TouchableOpacity>
        <Image source={{ uri: assetUrl(st.image)! }} style={s.hero} resizeMode="cover" />
        <View style={s.body}>
          <Text style={s.eyebrow}>YOGA STİLİ</Text>
          <Text style={s.title}>{st.name}</Text>
          <Text style={s.tag}>{st.tagline}</Text>
          <View style={s.pills}>
            <Text style={s.pill}>Yoğunluk {"●".repeat(st.intensity)}{"○".repeat(5 - st.intensity)}</Text>
            <Text style={s.pill}>{st.level}</Text>
            <Text style={s.pill}>⏱ {st.duration}</Text>
          </View>
          <Text style={s.lead}>{st.intro}</Text>

          <Text style={s.h2}>Kimler için?</Text>
          {st.forYou.map((x: string) => <Text key={x} style={s.li}>✓ {x}</Text>)}
          <Text style={s.h2}>Derste neler olur?</Text>
          {st.expect.map((x: string) => <Text key={x} style={s.li}>• {x}</Text>)}

          <Text style={s.h2}>Örnek ders</Text>
          {st.session.map((x: { time: string; part: string }) => (
            <View key={x.time} style={s.row}><Text style={s.time}>{x.time}</Text><Text style={s.part}>{x.part}</Text></View>
          ))}

          <Text style={s.h2}>Neler gerekli?</Text>
          {st.gear.map((x: string) => <Text key={x} style={s.li}>• {x}</Text>)}

          <Text style={s.h2}>Bu stilde sık yapılan pozlar</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {st.poses.map((p: any) => (
              <TouchableOpacity key={p.slug} onPress={() => router.push(`/pose/${p.slug}`)} style={s.mini}>
                <Image source={{ uri: assetUrl(p.image)! }} style={s.miniImg} />
                <Text style={s.miniText} numberOfLines={1}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={s.h2}>Sık sorulanlar</Text>
          {st.faq.map((f: { q: string; a: string }) => (
            <View key={f.q} style={s.faq}><Text style={s.faqQ}>{f.q}</Text><Text style={s.faqA}>{f.a}</Text></View>
          ))}
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
  hero: { width: "100%", height: 260, backgroundColor: colors.teal[100] },
  body: { padding: 20 },
  eyebrow: { color: colors.clay[600], fontSize: 11, letterSpacing: 1.5, fontWeight: "700" },
  title: { fontFamily: "serif", fontSize: 38, color: colors.ink, marginTop: 6 },
  tag: { color: colors.sage[600], fontSize: 16, marginTop: 4 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  pill: { backgroundColor: colors.teal[50], color: colors.teal[700], paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, overflow: "hidden", fontSize: 13 },
  lead: { color: colors.sage[700], fontSize: 16, lineHeight: 24, marginTop: 16 },
  h2: { fontFamily: "serif", fontSize: 24, color: colors.ink, marginTop: 28, marginBottom: 10 },
  li: { color: colors.sage[700], fontSize: 15, lineHeight: 22, marginBottom: 6 },
  row: { flexDirection: "row", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.rule },
  time: { width: 70, color: colors.clay[600], fontWeight: "700", fontSize: 13 },
  part: { flex: 1, color: colors.sage[800], fontSize: 15 },
  mini: { width: 110 },
  miniImg: { width: 110, height: 138, borderRadius: 14, backgroundColor: colors.teal[100] },
  miniText: { marginTop: 6, color: colors.ink, fontSize: 13 },
  faq: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.rule, borderRadius: 14, padding: 14, marginBottom: 10 },
  faqQ: { fontFamily: "serif", fontSize: 17, color: colors.ink, marginBottom: 4 },
  faqA: { color: colors.sage[700], fontSize: 14, lineHeight: 20 },
})
