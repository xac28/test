import React from "react"
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform, Alert } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { usePreventScreenCapture } from "expo-screen-capture"
import { colors } from "../constants"

export default function RoomScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>()
  const router = useRouter()
  
  // OS-Level Anti-Piracy: Prevents screenshots and screen recordings completely
  usePreventScreenCapture()

  return (
    <SafeAreaView style={styles.container}>
      {/* Header bar */}
      <View style={styles.header}>
        <Text style={styles.headerBrand}>NAMASTE</Text>
        <View style={styles.headerLive}>
          <View style={styles.headerDot} />
          <Text style={styles.headerLiveText}>LIVE HD</Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Camera icon */}
        <View style={styles.iconCircle}>
          <Text style={styles.iconEmoji}>🎥</Text>
        </View>
        
        <Text style={styles.title}>LiveKit Ready</Text>
        <Text style={styles.subtitle}>Session ID: {bookingId?.slice(0, 8)}...</Text>
        
        {/* Info card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📹</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>1080p @ 60 FPS</Text>
              <Text style={styles.infoDesc}>Enterprise-grade video quality</Text>
            </View>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>🔊</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>HD Audio</Text>
              <Text style={styles.infoDesc}>Echo cancellation & noise suppression</Text>
            </View>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>⚡</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Ultra-Low Latency</Text>
              <Text style={styles.infoDesc}>LiveKit WebRTC infrastructure</Text>
            </View>
          </View>
        </View>

        <Text style={styles.notice}>
          Native build required for live video.{"\n"}
          Run: npx expo install @livekit/react-native{"\n"}
          Then: npx expo prebuild
        </Text>

        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace("/(tabs)")}>
          <Text style={styles.primaryBtnText}>Return to Practice</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1714" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 24, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)",
  },
  headerBrand: { fontFamily: "serif", fontSize: 18, color: colors.white, letterSpacing: 6 },
  headerLive: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(239,68,68,0.15)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 50,
  },
  headerDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.red },
  headerLiveText: { fontSize: 11, fontWeight: "700", color: colors.red, letterSpacing: 1 },

  content: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "rgba(106, 138, 86, 0.15)",
    justifyContent: "center", alignItems: "center", marginBottom: 20,
    borderWidth: 1, borderColor: "rgba(106, 138, 86, 0.3)",
  },
  iconEmoji: { fontSize: 36 },
  title: { fontSize: 28, fontFamily: "serif", color: colors.white, marginBottom: 6 },
  subtitle: { fontSize: 14, color: colors.sage[500], marginBottom: 28 },

  infoCard: {
    width: "100%", backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 20, padding: 20, marginBottom: 24,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 4 },
  infoIcon: { fontSize: 24 },
  infoTitle: { fontSize: 15, fontWeight: "600", color: colors.white },
  infoDesc: { fontSize: 12, color: colors.sage[500], marginTop: 1 },
  infoDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginVertical: 12 },

  notice: {
    fontSize: 12, color: colors.sage[600], textAlign: "center", lineHeight: 20,
    marginBottom: 28, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },

  primaryBtn: {
    backgroundColor: colors.sage[600], paddingHorizontal: 36, paddingVertical: 16,
    borderRadius: 50,
    shadowColor: colors.sage[600], shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12,
  },
  primaryBtnText: { color: colors.white, fontWeight: "700", fontSize: 16, letterSpacing: 0.5 },
})
