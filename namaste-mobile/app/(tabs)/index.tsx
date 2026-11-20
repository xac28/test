import React, { useEffect, useState, useCallback } from "react"
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator,
  SafeAreaView, StatusBar,
} from "react-native"
import { useRouter } from "expo-router"
import { useAuth } from "../../context/auth"
import { API_BASE, colors } from "../../constants"

interface Booking {
  id: string
  startTime: string
  endTime: string
  status: string
  price: number
  teacher?: { user: { name: string; image: string | null } }
  student?: { name: string; image: string | null }
}

export default function DashboardScreen() {
  const { user, token, signOut } = useAuth()
  const router = useRouter()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchBookings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/mobile/bookings`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setBookings(data.bookings || [])
      }
    } catch (e) {
      console.error("Rezervasyonlar alınamadı", e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [token])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  const onRefresh = () => {
    setRefreshing(true)
    fetchBookings()
  }

  const isLive = (b: Booking) => {
    const now = new Date()
    return new Date(b.startTime) <= now && new Date(b.endTime) >= now && b.status === "CONFIRMED"
  }

  const upcomingBookings = bookings.filter(b => new Date(b.endTime) >= new Date() && ["CONFIRMED", "PENDING"].includes(b.status))
  const pastBookings = bookings.filter(b => new Date(b.endTime) < new Date() || b.status === "COMPLETED")

  const renderBooking = ({ item }: { item: Booking }) => {
    const live = isLive(item)
    const otherName = user?.role === "TEACHER"
      ? item.student?.name || "Öğrenci"
      : item.teacher?.user?.name || "Eğitmen"
    const initial = otherName[0]?.toUpperCase() || "?"

    return (
      <TouchableOpacity
        style={[styles.card, live && styles.cardLive]}
        activeOpacity={0.85}
        onPress={() => {
          if (item.status === "CONFIRMED") {
            router.push(`/room?bookingId=${item.id}`)
          }
        }}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.avatar, live && styles.avatarLive]}>
            <Text style={[styles.avatarText, live && { color: colors.white }]}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardName}>{otherName}</Text>
            <Text style={styles.cardDate}>
              {new Date(item.startTime).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              {" · "}
              {new Date(item.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
          {live && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>

        <View style={styles.cardInfo}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Süre</Text>
            <Text style={styles.infoValue}>60 min</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Ücret</Text>
            <Text style={styles.infoValue}>${item.price?.toFixed(2) || "0.00"}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Durum</Text>
            <View style={[styles.statusBadge, item.status === "CONFIRMED" ? styles.statusConfirmed : styles.statusPending]}>
              <Text style={[styles.statusText, item.status === "CONFIRMED" ? styles.statusConfirmedText : styles.statusPendingText]}>
                {item.status === "CONFIRMED" ? "Onaylandı" : item.status === "COMPLETED" ? "Tamamlandı" : "Bekliyor"}
              </Text>
            </View>
          </View>
        </View>

        {item.status === "CONFIRMED" && (
          <View style={[styles.joinButton, live && styles.joinButtonLive]}>
            <Text style={styles.joinText}>{live ? "🔴 Canlı derse katıl" : "Derse katıl"}</Text>
          </View>
        )}
      </TouchableOpacity>
    )
  }

  if (loading) {
    return (
      <View style={styles.loader}>
        <View style={styles.loaderCircle}>
          <ActivityIndicator size="large" color={colors.sage[600]} />
        </View>
        <Text style={styles.loaderText}>Pratiğin yükleniyor…</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Tekrar hoş geldin</Text>
          <Text style={styles.name}>{user?.name || "Öğrenci"}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={[styles.logoutBtn, { backgroundColor: colors.sage[100], borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 }]}>
            <Text style={[styles.logoutText, { color: colors.sage[700] }]}>🔔</Text>
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{upcomingBookings.length}</Text>
          <Text style={styles.statLabel}>Yaklaşan</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{pastBookings.length}</Text>
          <Text style={styles.statLabel}>Tamamlanan</Text>
        </View>
        <View style={[styles.statCard, styles.statCardAccent]}>
          <Text style={[styles.statNumber, { color: colors.white }]}>{bookings.length}</Text>
          <Text style={[styles.statLabel, { color: colors.sage[200] }]}>Toplam</Text>
        </View>
      </View>

      {/* Section Title */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Derslerin</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Text style={styles.sectionAction}>Yenile</Text>
        </TouchableOpacity>
      </View>

      {/* Bookings */}
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        renderItem={renderBooking}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.sage[600]} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyCircle}>
              <Text style={styles.emptyIcon}>🧘</Text>
            </View>
            <Text style={styles.emptyTitle}>Matın seni bekliyor</Text>
            <Text style={styles.emptyText}>Henüz dersin yok. İlk pratiğini eğitmenler sekmesinden ya da web sitemizden ayır!</Text>
          </View>
        }
      />
      {/* AI Floating Button */}
      <TouchableOpacity
        style={styles.aiFab}
        activeOpacity={0.8}
        onPress={() => router.push("/ai")}
      >
        <Text style={styles.aiFabIcon}>✨</Text>
        <Text style={styles.aiFabLabel}>AI</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  loader: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.cream },
  loaderCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.sage[100], justifyContent: "center", alignItems: "center", marginBottom: 16 },
  loaderText: { fontSize: 16, fontFamily: "serif", color: colors.sage[600] },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: colors.sage[100],
  },
  greeting: { fontSize: 13, color: colors.sage[500], textTransform: "uppercase", letterSpacing: 2, fontWeight: "600" },
  name: { fontSize: 26, fontFamily: "serif", color: colors.sage[900], marginTop: 2 },
  logoutBtn: { backgroundColor: colors.sage[100], paddingHorizontal: 16, paddingVertical: 10, borderRadius: 50 },
  logoutText: { color: colors.sage[700], fontWeight: "600", fontSize: 13 },

  statsRow: { flexDirection: "row", paddingHorizontal: 20, paddingVertical: 16, gap: 10 },
  statCard: {
    flex: 1, backgroundColor: colors.white, borderRadius: 20, padding: 16, alignItems: "center",
    borderWidth: 1, borderColor: colors.sage[100],
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1,
  },
  statCardAccent: { backgroundColor: colors.sage[700], borderColor: colors.sage[700] },
  statNumber: { fontSize: 28, fontFamily: "serif", color: colors.sage[900], marginBottom: 2 },
  statLabel: { fontSize: 11, color: colors.sage[500], fontWeight: "600", textTransform: "uppercase", letterSpacing: 1 },

  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 },
  sectionTitle: { fontSize: 20, fontFamily: "serif", color: colors.sage[900] },
  sectionAction: { fontSize: 14, color: colors.sage[600], fontWeight: "600" },

  list: { paddingHorizontal: 20, paddingBottom: 40 },
  card: {
    backgroundColor: colors.white, borderRadius: 22, padding: 20, marginBottom: 14,
    borderWidth: 1, borderColor: colors.sage[100],
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2,
  },
  cardLive: { borderColor: colors.green, borderWidth: 1.5 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14 },
  avatar: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: colors.sage[100],
    justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: colors.white,
  },
  avatarLive: { backgroundColor: colors.green },
  avatarText: { fontSize: 20, fontFamily: "serif", color: colors.sage[700] },
  cardName: { fontSize: 17, fontWeight: "600", color: colors.sage[900] },
  cardDate: { fontSize: 13, color: colors.sage[500], marginTop: 2 },
  cardInfo: {
    flexDirection: "row", gap: 8, marginBottom: 14, padding: 12, borderRadius: 14,
    backgroundColor: colors.sage[50],
  },
  infoItem: { flex: 1, alignItems: "center" },
  infoLabel: { fontSize: 11, color: colors.sage[400], fontWeight: "500", marginBottom: 2 },
  infoValue: { fontSize: 14, color: colors.sage[800], fontWeight: "600" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  statusConfirmed: { backgroundColor: "#f0fdf4" },
  statusPending: { backgroundColor: colors.sage[100] },
  statusText: { fontSize: 12, fontWeight: "600" },
  statusConfirmedText: { color: "#15803d" },
  statusPendingText: { color: colors.sage[500] },
  liveBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#f0fdf4", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 50,
    borderWidth: 1, borderColor: "#bbf7d0",
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },
  liveText: { fontSize: 11, fontWeight: "700", color: "#15803d", letterSpacing: 1 },
  joinButton: {
    backgroundColor: colors.sage[600], borderRadius: 16, paddingVertical: 15, alignItems: "center",
    shadowColor: colors.sage[900], shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 3,
  },
  joinButtonLive: { backgroundColor: colors.green },
  joinText: { color: colors.white, fontSize: 16, fontWeight: "700", letterSpacing: 0.5 },
  empty: { alignItems: "center", paddingVertical: 60 },
  emptyCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: colors.sage[100],
    justifyContent: "center", alignItems: "center", marginBottom: 20,
  },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { fontSize: 22, fontFamily: "serif", color: colors.sage[800], marginBottom: 8 },
  emptyText: { fontSize: 15, color: colors.sage[500], textAlign: "center", paddingHorizontal: 40 },

  aiFab: {
    position: "absolute", bottom: 24, right: 20,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.sage[600],
    justifyContent: "center", alignItems: "center",
    shadowColor: colors.sage[900], shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25, shadowRadius: 16, elevation: 8,
  },
  aiFabIcon: { fontSize: 20, marginBottom: -2 },
  aiFabLabel: { fontSize: 9, fontWeight: "800", color: colors.white, letterSpacing: 1 },
})
