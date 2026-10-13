import React, { useCallback, useEffect, useState } from "react"
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, RefreshControl, Linking } from "react-native"
import { useAuth } from "../../context/auth"
import { api } from "../../lib/api"
import { API_BASE, assetUrl, colors } from "../../constants"

interface Post { id: string; content: string; image: string | null; mediaType: string; likeCount: number; commentCount: number; liked: boolean; createdAt: string; author: { id: string; name: string | null; image: string | null; isTeacher: boolean } }

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (m < 1) return "az önce"
  if (m < 60) return `${m} dk önce`
  if (m < 1440) return `${Math.round(m / 60)} sa önce`
  return `${Math.round(m / 1440)} gün önce`
}

export default function CommunityScreen() {
  const { token } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [more, setMore] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async (reset: boolean) => {
    if (reset) setError("")
    const r = await api(`/api/community${!reset && cursor ? `?cursor=${cursor}` : ""}`, { token })
    if (!r.ok) { setError(r.data?.error || "Paylaşımlar alınamadı"); return }
    setPosts((prev) => (reset ? r.data.posts : [...prev, ...r.data.posts]))
    setCursor(r.data.nextCursor)
  }, [cursor, token])

  useEffect(() => { load(true).finally(() => setLoading(false)) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const like = async (p: Post) => {
    // optimistic: the heart responds at once, the server's answer corrects it
    setPosts((prev) => prev.map((x) => (x.id === p.id ? { ...x, liked: !x.liked, likeCount: x.likeCount + (x.liked ? -1 : 1) } : x)))
    const r = await api(`/api/community/${p.id}/like`, { token, method: "POST" })
    if (r.ok) setPosts((prev) => prev.map((x) => (x.id === p.id ? { ...x, liked: r.data.liked, likeCount: r.data.likeCount } : x)))
    else setPosts((prev) => prev.map((x) => (x.id === p.id ? { ...x, liked: p.liked, likeCount: p.likeCount } : x)))
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Topluluk</Text>
        <Text style={s.sub}>Üyelerin pratiğinden kareler</Text>
      </View>
      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.teal[600]} /></View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, gap: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(true); setRefreshing(false) }} tintColor={colors.teal[600]} />}
          onEndReachedThreshold={0.5}
          onEndReached={async () => { if (cursor && !more) { setMore(true); await load(false); setMore(false) } }}
          ListEmptyComponent={<Text style={[s.sub, { textAlign: "center", marginTop: 48 }]}>{error || "Henüz paylaşım yok. İlk kareyi web sitesinden paylaşabilirsin."}</Text>}
          ListFooterComponent={more ? <ActivityIndicator style={{ marginVertical: 16 }} color={colors.teal[600]} /> : null}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.author}>
                <View style={s.avatar}>{item.author.image ? <Image source={{ uri: assetUrl(item.author.image)! }} style={s.avatarImg} /> : <Text style={s.avatarText}>{(item.author.name || "?")[0].toUpperCase()}</Text>}</View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{item.author.name || "Üye"}{item.author.isTeacher ? "  · Eğitmen" : ""}</Text>
                  <Text style={s.time}>{ago(item.createdAt)}</Text>
                </View>
              </View>
              {item.image && item.mediaType !== "video" && <Image source={{ uri: assetUrl(item.image)! }} style={s.photo} resizeMode="cover" />}
              {item.image && item.mediaType === "video" && (
                <TouchableOpacity onPress={() => Linking.openURL(assetUrl(item.image)!)} style={[s.photo, s.videoBox]}><Text style={{ color: colors.white, fontSize: 40 }}>▶</Text></TouchableOpacity>
              )}
              {!!item.content && <Text style={s.content}>{item.content}</Text>}
              <View style={s.actions}>
                <TouchableOpacity onPress={() => (token ? like(item) : undefined)} disabled={!token} style={s.actionBtn} accessibilityRole="button" accessibilityLabel={item.liked ? "Beğeniyi geri al" : "Beğen"}>
                  <Text style={[s.heart, item.liked && { color: colors.clay[500] }]}>{item.liked ? "♥" : "♡"}</Text>
                  <Text style={s.count}>{item.likeCount}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => Linking.openURL(`${API_BASE}/community/${item.id}`)} style={s.actionBtn} accessibilityRole="link">
                  <Text style={s.count}>💬 {item.commentCount} yorum</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: { paddingHorizontal: 20, paddingTop: 12 },
  title: { fontFamily: "serif", fontSize: 32, color: colors.ink },
  sub: { color: colors.sage[500], fontSize: 14, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: colors.paper, borderRadius: 20, borderWidth: 1, borderColor: colors.rule, overflow: "hidden" },
  author: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.clay[100], alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: 40, height: 40 },
  avatarText: { color: colors.clay[600], fontWeight: "700" },
  name: { color: colors.ink, fontWeight: "600" },
  time: { color: colors.sage[400], fontSize: 12 },
  photo: { width: "100%", aspectRatio: 1, backgroundColor: colors.teal[100] },
  videoBox: { alignItems: "center", justifyContent: "center", backgroundColor: colors.teal[800] },
  content: { color: colors.sage[800], fontSize: 15, lineHeight: 22, paddingHorizontal: 14, paddingTop: 12 },
  actions: { flexDirection: "row", gap: 8, paddingHorizontal: 6, paddingVertical: 4 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 10 },
  heart: { fontSize: 24, color: colors.sage[500] },
  count: { color: colors.sage[600], fontSize: 14 },
})
