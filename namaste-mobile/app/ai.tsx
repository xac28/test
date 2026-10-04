import React, { useState, useRef, useEffect } from "react"
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView,
  Platform, SafeAreaView, StatusBar, Animated, Dimensions,
} from "react-native"
import { useRouter } from "expo-router"
import { useAuth } from "../context/auth"
import { API_BASE, colors } from "../constants"

const { width } = Dimensions.get("window")

interface Message {
  id: string
  role: "user" | "ai"
  text: string
  teachers?: any[]
  timestamp: Date
}

const QUICK_PROMPTS = [
  { icon: "🧘", text: "Başlangıç seviyesi yoga" },
  { icon: "😰", text: "Stres için öneriniz?" },
  { icon: "💪", text: "Güçlendirme yogası" },
  { icon: "🌙", text: "Uyku öncesi rahatlama" },
  { icon: "🤰", text: "Hamilelik yogası" },
  { icon: "🔥", text: "Kilo verme programı" },
]

export default function AIScreen() {
  const { token } = useAuth()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "ai",
      text: "🙏 Merhaba! Ben AYA, yapay zeka yoga asistanınızım.\n\nSize en uygun öğretmeni bulabilir, yoga stilleri hakkında bilgi verebilir ve kişisel öneriler sunabilirim.",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [showQuick, setShowQuick] = useState(true)
  const flatListRef = useRef<FlatList>(null)
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start()
  }, [])

  const handleSend = async (text?: string) => {
    const userMsg = (text || input).trim()
    if (!userMsg || loading) return

    setInput("")
    setShowQuick(false)
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      text: userMsg,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/ai/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      })
      const data = await res.json()
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        text: data.reply || "Şu an yardımcı olamıyorum, tekrar deneyin.",
        teachers: data.teachers,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, aiMessage])
    } catch {
      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "ai", text: "Bağlantı hatası. Tekrar deneyin.", timestamp: new Date() },
      ])
    } finally {
      setLoading(false)
    }
  }

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isUser = item.role === "user"
    return (
      <Animated.View
        style={[
          styles.messageBubbleWrap,
          { alignItems: isUser ? "flex-end" : "flex-start" },
          { opacity: fadeAnim },
        ]}
      >
        {!isUser && (
          <View style={styles.aiAvatar}>
            <Text style={styles.aiAvatarText}>✨</Text>
          </View>
        )}
        <View
          style={[
            styles.bubble,
            isUser ? styles.userBubble : styles.aiBubble,
          ]}
        >
          <Text style={[styles.bubbleText, isUser && { color: colors.white }]}>
            {item.text}
          </Text>

          {/* Teacher recommendations */}
          {item.teachers && item.teachers.length > 0 && (
            <View style={styles.teacherCards}>
              {item.teachers.map((t: any, j: number) => (
                <TouchableOpacity key={j} style={styles.teacherCard} activeOpacity={0.7}>
                  <View style={styles.teacherAvatar}>
                    <Text style={styles.teacherInitial}>{(t.name || "T")[0]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.teacherName}>{t.name}</Text>
                    <Text style={styles.teacherMeta}>⭐ {t.rating} · ${t.hourlyRate}/hr</Text>
                  </View>
                  <Text style={styles.teacherArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={[styles.timestamp, isUser && { color: "rgba(255,255,255,0.5)" }]}>
            {item.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
      </Animated.View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerDot} />
          <Text style={styles.headerTitle}>AYA AI</Text>
          <View style={styles.proBadge}>
            <Text style={styles.proText}>PRO</Text>
          </View>
        </View>
        <Text style={styles.headerSubtitle}>Powered by Gemini</Text>
      </Animated.View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={
          loading ? (
            <View style={styles.typingWrap}>
              <View style={styles.aiAvatar}>
                <Text style={styles.aiAvatarText}>✨</Text>
              </View>
              <View style={styles.typingBubble}>
                <View style={styles.typingDots}>
                  {[0, 1, 2].map(i => (
                    <Animated.View key={i} style={[styles.dot, { opacity: fadeAnim }]} />
                  ))}
                </View>
                <Text style={styles.typingLabel}>düşünüyor...</Text>
              </View>
            </View>
          ) : null
        }
      />

      {/* Quick Prompts */}
      {showQuick && (
        <Animated.View style={[styles.quickWrap, { opacity: fadeAnim }]}>
          <Text style={styles.quickTitle}>💡 Hızlı Başlangıç</Text>
          <FlatList
            data={QUICK_PROMPTS}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.text}
            contentContainerStyle={styles.quickList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.quickChip}
                onPress={() => handleSend(item.text)}
                activeOpacity={0.7}
              >
                <Text style={styles.quickIcon}>{item.icon}</Text>
                <Text style={styles.quickText}>{item.text}</Text>
              </TouchableOpacity>
            )}
          />
        </Animated.View>
      )}

      {/* Input */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.inputWrap}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Size nasıl yardımcı olabilirim?"
              placeholderTextColor={colors.sage[400]}
              onSubmitEditing={() => handleSend()}
              returnKeyType="send"
              editable={!loading}
            />
            <TouchableOpacity
              onPress={() => handleSend()}
              disabled={!input.trim() || loading}
              style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
              activeOpacity={0.7}
            >
              <Text style={styles.sendIcon}>↑</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },

  // Header
  header: {
    alignItems: "center", paddingVertical: 16, borderBottomWidth: 1,
    borderBottomColor: colors.sage[100], backgroundColor: colors.cream,
  },
  backBtn: {
    position: "absolute", left: 20, top: 16,
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.sage[100],
    justifyContent: "center", alignItems: "center",
  },
  backText: { fontSize: 18, color: colors.sage[700] },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22c55e" },
  headerTitle: { fontSize: 20, fontFamily: "serif", color: colors.sage[900], fontWeight: "600" },
  proBadge: {
    backgroundColor: colors.sage[600], paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
  },
  proText: { color: colors.white, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  headerSubtitle: { fontSize: 11, color: colors.sage[400], marginTop: 2 },

  // Messages
  messageList: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 20 },
  messageBubbleWrap: { flexDirection: "row", marginBottom: 12, gap: 8 },
  aiAvatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.sage[200],
    justifyContent: "center", alignItems: "center", marginTop: 4,
  },
  aiAvatarText: { fontSize: 14 },
  bubble: { maxWidth: width * 0.72, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12 },
  userBubble: {
    backgroundColor: colors.sage[600], borderBottomRightRadius: 6,
    shadowColor: colors.sage[900], shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  aiBubble: {
    backgroundColor: colors.white, borderBottomLeftRadius: 6,
    borderWidth: 1, borderColor: colors.sage[100],
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  bubbleText: { fontSize: 14, lineHeight: 22, color: colors.sage[800] },
  timestamp: { fontSize: 9, color: colors.sage[400], textAlign: "right", marginTop: 6 },

  // Teacher cards
  teacherCards: { marginTop: 10, borderTopWidth: 1, borderTopColor: colors.sage[100], paddingTop: 10, gap: 6 },
  teacherCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: colors.sage[50], padding: 10, borderRadius: 14,
    borderWidth: 1, borderColor: colors.sage[100],
  },
  teacherAvatar: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: colors.sage[200],
    justifyContent: "center", alignItems: "center",
  },
  teacherInitial: { fontSize: 16, fontFamily: "serif", color: colors.sage[700] },
  teacherName: { fontSize: 13, fontWeight: "600", color: colors.sage[900] },
  teacherMeta: { fontSize: 10, color: colors.sage[500], marginTop: 2 },
  teacherArrow: { fontSize: 22, color: colors.sage[400] },

  // Typing
  typingWrap: { flexDirection: "row", gap: 8, marginTop: 4, paddingLeft: 4 },
  typingBubble: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.white, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: colors.sage[100],
  },
  typingDots: { flexDirection: "row", gap: 4 },
  dot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: colors.sage[400],
  },
  typingLabel: { fontSize: 11, color: colors.sage[400] },

  // Quick prompts
  quickWrap: {
    borderTopWidth: 1, borderTopColor: colors.sage[100],
    paddingVertical: 10, backgroundColor: colors.cream,
  },
  quickTitle: { fontSize: 10, color: colors.sage[400], fontWeight: "600", paddingLeft: 20, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 },
  quickList: { paddingHorizontal: 16, gap: 8 },
  quickChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.white, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 50, borderWidth: 1, borderColor: colors.sage[100],
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  quickIcon: { fontSize: 16 },
  quickText: { fontSize: 12, color: colors.sage[700], fontWeight: "500" },

  // Input
  inputWrap: {
    borderTopWidth: 1, borderTopColor: colors.sage[100],
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.cream,
  },
  inputRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.white, borderRadius: 24, paddingLeft: 18, paddingRight: 6,
    paddingVertical: 4, borderWidth: 1, borderColor: colors.sage[200],
  },
  input: { flex: 1, fontSize: 14, color: colors.sage[800], paddingVertical: 10 },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.sage[600],
    justifyContent: "center", alignItems: "center",
    shadowColor: colors.sage[900], shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 2,
  },
  sendBtnDisabled: { backgroundColor: colors.sage[200], shadowOpacity: 0 },
  sendIcon: { fontSize: 18, fontWeight: "800", color: colors.white },
})
