import React, { useEffect, useState, useCallback } from "react"
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Image, ActivityIndicator } from "react-native"
import { useRouter } from "expo-router"
import { API_BASE, colors } from "../../constants"
import { StatusBar } from "expo-status-bar"
import { useAuth } from "../../context/auth"

interface Teacher {
  id: string
  name: string
  avatar: string
  country: string
  specialties: string[]
  hourlyRate: number
  rating: number
  reviewCount: number
}

export default function TeachersScreen() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()
  const { token } = useAuth()

  const fetchTeachers = useCallback(async () => {
    try {
      // The API automatically filters out trial teachers (isTrialMode: false)
      const res = await fetch(`${API_BASE}/api/teachers`)
      if (res.ok) {
        const data = await res.json()
        setTeachers(data)
      }
    } catch (e) {
      console.error("Eğitmenler alınamadı", e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchTeachers()
  }, [fetchTeachers])

  const renderTeacher = ({ item }: { item: Teacher }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
        <View style={styles.infoContainer}>
          <Text style={styles.name}>{item.name}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.country}>🌍 {item.country}</Text>
            <Text style={styles.rating}>⭐ {item.rating.toFixed(1)} ({item.reviewCount})</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.specialties}>
        {item.specialties.slice(0, 3).map((spec, i) => (
          <View key={i} style={styles.badge}>
            <Text style={styles.badgeText}>{spec}</Text>
          </View>
        ))}
        {item.specialties.length > 3 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>+{item.specialties.length - 3}</Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <View>
          <Text style={styles.priceLabel}>Saatlik ücret</Text>
          <Text style={styles.priceValue}>${item.hourlyRate.toFixed(2)}</Text>
        </View>
        <TouchableOpacity 
          style={styles.bookButton}
          activeOpacity={0.8}
          onPress={() => alert(`Booking functionality for ${item.name} will be available in the next update!`)}
        >
          <Text style={styles.bookButtonText}>Ders ayır</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.sage[600]} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Eğitmen bul</Text>
        <Text style={styles.headerSubtitle}>Sana uygun rehberi keşfet</Text>
      </View>

      <FlatList
        data={teachers}
        keyExtractor={item => item.id}
        renderItem={renderTeacher}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTeachers(); }} tintColor={colors.sage[600]} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyTitle}>Eğitmen bulunamadı</Text>
            <Text style={styles.emptyText}>Şu anda aktif eğitmen yok.</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.cream,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.sage[100],
  },
  headerTitle: {
    fontFamily: "serif",
    fontSize: 32,
    color: colors.sage[900],
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: colors.sage[500],
    marginTop: 4,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.sage[100],
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.sage[100],
    borderWidth: 2,
    borderColor: colors.white,
  },
  infoContainer: {
    flex: 1,
  },
  name: {
    fontFamily: "serif",
    fontSize: 20,
    color: colors.sage[900],
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  country: {
    fontSize: 13,
    color: colors.sage[600],
  },
  rating: {
    fontSize: 13,
    color: colors.sage[600],
    fontWeight: "600",
  },
  specialties: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  badge: {
    backgroundColor: colors.sage[50],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: colors.sage[200],
  },
  badgeText: {
    fontSize: 11,
    color: colors.sage[700],
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.sage[100],
  },
  priceLabel: {
    fontSize: 11,
    color: colors.sage[400],
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  priceValue: {
    fontFamily: "serif",
    fontSize: 20,
    color: colors.sage[900],
  },
  bookButton: {
    backgroundColor: colors.sage[700],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 50,
    shadowColor: colors.sage[900],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  bookButtonText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 14,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: "serif",
    fontSize: 22,
    color: colors.sage[900],
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: colors.sage[500],
    textAlign: "center",
    maxWidth: "80%",
  },
})
