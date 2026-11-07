import React, { useCallback, useEffect, useMemo, useState } from "react"
import { View, Text, TextInput, FlatList, Image, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, ScrollView } from "react-native"
import { useRouter } from "expo-router"
import { api } from "../../lib/api"
import { assetUrl, colors } from "../../constants"

interface PoseItem { slug: string; name: string; sanskrit: string; category: string; level: string; hold: string; summary: string; image: string }
interface StyleItem { slug: string; name: string; tagline: string; intensity: number; level: string; duration: string; image: string }

const CATEGORIES = ["Ayakta", "Oturarak", "Öne eğilme", "Geriye eğilme", "Denge", "Dinlenme", "Ters ve güç"]
const levelColor = (l: string) => (l === "Başlangıç" ? colors.teal[600] : l === "Orta" ? colors.saffron[600] : colors.clay[600])

export default function PosesScreen() {
  const router = useRouter()
  const [tab, setTab] = useState<"poses" | "styles">("poses")
  const [q, setQ] = useState("")
  const [cat, setCat] = useState("")
  const [poses, setPoses] = useState<PoseItem[]>([])
  const [styles, setStyles] = useState<StyleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    const [p, s] = await Promise.all([api("/api/poses"), api("/api/styles")])
    if (!p.ok || !s.ok) setError(p.data?.error || s.data?.error || "Yüklenemedi")
    else { setPoses(p.data.poses); setStyles(s.data.styles) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const shown = useMemo(() => {
    const f = q.trim().toLocaleLowerCase("tr")
    return poses.filter((p) => (!cat || p.category === cat) && (!f || `${p.name} ${p.sanskrit} ${p.summary}`.toLocaleLowerCase("tr").includes(f)))
  }, [poses, q, cat])

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Yoga</Text>
        <View style={s.segment} accessibilityRole="tablist">
          {(["poses", "styles"] as const).map((t) => (
            <TouchableOpacity key={t} onPress={() => setTab(t)} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} style={[s.segBtn, tab === t && s.segBtnOn]}>
              <Text style={[s.segText, tab === t && s.segTextOn]}>{t === "poses" ? "Pozlar" : "Stiller"}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.teal[600]} /></View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.muted}>{error}</Text>
          <TouchableOpacity onPress={load} style={s.retry}><Text style={s.retryText}>Tekrar dene</Text></TouchableOpacity>
        </View>
      ) : tab === "poses" ? (
        <FlatList
          data={shown}
          keyExtractor={(p) => p.slug}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={{ gap: 12, marginBottom: 4 }}>
              <TextInput value={q} onChangeText={setQ} placeholder="Poz ara: ağaç, tadasana…" placeholderTextColor={colors.sage[400]} style={s.search} returnKeyType="search" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {["", ...CATEGORIES].map((c) => (
                  <TouchableOpacity key={c || "all"} onPress={() => setCat(c)} style={[s.chip, cat === c && s.chipOn]}>
                    <Text style={[s.chipText, cat === c && s.chipTextOn]}>{c || "Tümü"}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={s.muted}>{shown.length} poz</Text>
            </View>
          }
          ListEmptyComponent={<Text style={[s.muted, { textAlign: "center", marginTop: 40 }]}>Aramana uyan poz bulunamadı.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.card} activeOpacity={0.85} onPress={() => router.push(`/pose/${item.slug}`)} accessibilityLabel={`${item.name}, ${item.level}`}>
              <Image source={{ uri: assetUrl(item.image)! }} style={s.cardImg} resizeMode="cover" />
              <View style={{ padding: 10 }}>
                <Text style={[s.level, { color: levelColor(item.level) }]}>{item.level.toUpperCase()}</Text>
                <Text style={s.cardTitle} numberOfLines={1}>{item.name}</Text>
                <Text style={s.cardSub} numberOfLines={1}>{item.sanskrit}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={styles}
          keyExtractor={(x) => x.slug}
          contentContainerStyle={{ padding: 16, gap: 14 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.styleCard} activeOpacity={0.9} onPress={() => router.push(`/style/${item.slug}`)} accessibilityLabel={item.name}>
              <Image source={{ uri: assetUrl(item.image)! }} style={s.styleImg} resizeMode="cover" />
              <View style={s.styleShade} />
              <View style={s.styleText}>
                <Text style={s.styleName}>{item.name}</Text>
                <Text style={s.styleTag} numberOfLines={2}>{item.tagline}</Text>
                <Text style={s.styleMeta}>{item.level} · {item.duration}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: { paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  title: { fontFamily: "serif", fontSize: 32, color: colors.ink },
  segment: { flexDirection: "row", backgroundColor: colors.sage[100], borderRadius: 999, padding: 4, alignSelf: "flex-start" },
  segBtn: { paddingHorizontal: 18, minHeight: 40, justifyContent: "center", borderRadius: 999 },
  segBtnOn: { backgroundColor: colors.ink },
  segText: { color: colors.sage[700], fontWeight: "600" },
  segTextOn: { color: colors.cream },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  muted: { color: colors.sage[500], fontSize: 13 },
  retry: { backgroundColor: colors.clay[500], paddingHorizontal: 20, minHeight: 44, justifyContent: "center", borderRadius: 999 },
  retryText: { color: colors.white, fontWeight: "700" },
  search: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.rule, borderRadius: 999, paddingHorizontal: 18, minHeight: 46, color: colors.ink },
  chip: { paddingHorizontal: 14, minHeight: 40, justifyContent: "center", borderRadius: 999, borderWidth: 1, borderColor: colors.rule, backgroundColor: colors.paper },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { color: colors.sage[700], fontSize: 13 },
  chipTextOn: { color: colors.cream },
  card: { flex: 1, backgroundColor: colors.paper, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: colors.rule },
  cardImg: { width: "100%", aspectRatio: 4 / 5, backgroundColor: colors.teal[100] },
  level: { fontSize: 10, letterSpacing: 1, fontWeight: "700" },
  cardTitle: { fontFamily: "serif", fontSize: 18, color: colors.ink, marginTop: 2 },
  cardSub: { fontSize: 12, fontStyle: "italic", color: colors.sage[500] },
  styleCard: { borderRadius: 22, overflow: "hidden", height: 190, backgroundColor: colors.teal[100], borderWidth: 1, borderColor: colors.rule },
  styleImg: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  styleShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(18,48,46,0.45)" },
  styleText: { position: "absolute", left: 18, right: 18, bottom: 16 },
  styleName: { fontFamily: "serif", fontSize: 28, color: colors.white },
  styleTag: { color: "rgba(255,255,255,0.92)", fontSize: 13, marginTop: 2 },
  styleMeta: { color: colors.saffron[300], fontSize: 12, marginTop: 6, fontWeight: "600" },
})
