import React, { useState } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Animated,
} from "react-native"
import { useRouter } from "expo-router"
import { useAuth } from "../context/auth"
import { colors } from "../constants"

export default function LoginScreen() {
  const router = useRouter()
  const { signIn } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [loginSuccess, setLoginSuccess] = useState(false)
  const pulseAnim = React.useRef(new Animated.Value(1)).current
  const fadeAnim = React.useRef(new Animated.Value(0)).current

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter email and password")
      return
    }

    setLoading(true)
    const result = await signIn(email.trim(), password.trim())

    if (result.success) {
      setLoginSuccess(true)
      
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
          ])
        )
      ]).start()

      // 3.5 second simulated loading for premium feel
      setTimeout(() => {
        router.replace("/(tabs)")
      }, 3500)
    } else {
      setLoading(false)
      Alert.alert("Login Failed", result.error || "Invalid credentials")
    }
  }

  if (loginSuccess) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
          <Animated.View style={[styles.logoCircle, { transform: [{ scale: pulseAnim }], marginBottom: 30, width: 100, height: 100, borderRadius: 50 }]}>
            <Text style={{ fontSize: 40 }}>🧘</Text>
          </Animated.View>
          <Text style={{ fontFamily: 'serif', fontSize: 24, color: colors.sage[900], letterSpacing: 2 }}>AYA</Text>
          <Text style={{ color: colors.sage[500], marginTop: 10, fontStyle: 'italic' }}>Preparing your practice...</Text>
        </Animated.View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Decorative elements */}
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />

        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>🧘</Text>
            </View>
          </View>
          <Text style={styles.brand}>AYA</Text>
          <Text style={styles.tagline}>Your practice, anywhere you breathe.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome Back</Text>
          <Text style={styles.cardSubtitle}>Sign in to continue your journey</Text>

          <View style={styles.form}>
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Email</Text>
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
              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputContainer, focusedField === "password" && styles.inputFocused]}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={colors.sage[300]}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>{loading ? "Signing in..." : "Sign In"}</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity onPress={() => router.push("/register")} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Create New Account</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.footer}>
          By signing in, you agree to our Terms of Service{"\n"}and Privacy Policy.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  decorCircle1: {
    position: "absolute",
    top: -60,
    right: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.sage[100],
    opacity: 0.5,
  },
  decorCircle2: {
    position: "absolute",
    bottom: -40,
    left: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.clay[100],
    opacity: 0.3,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoContainer: {
    marginBottom: 16,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.sage[100],
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.sage[200],
  },
  logoEmoji: {
    fontSize: 32,
  },
  brand: {
    fontFamily: "serif",
    fontSize: 38,
    letterSpacing: 10,
    color: colors.sage[900],
    marginBottom: 8,
  },
  tagline: {
    fontSize: 15,
    color: colors.sage[500],
    textAlign: "center",
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 28,
    padding: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.sage[100],
  },
  cardTitle: {
    fontSize: 24,
    fontFamily: "serif",
    color: colors.sage[900],
    textAlign: "center",
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: colors.sage[500],
    textAlign: "center",
    marginBottom: 28,
  },
  form: {
    gap: 18,
  },
  inputWrapper: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.sage[800],
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.sage[50],
    borderWidth: 1.5,
    borderColor: colors.sage[200],
    borderRadius: 16,
    paddingHorizontal: 16,
    gap: 10,
  },
  inputFocused: {
    borderColor: colors.sage[500],
    backgroundColor: colors.white,
    shadowColor: colors.sage[600],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  inputIcon: {
    fontSize: 18,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: colors.ink,
  },
  button: {
    backgroundColor: colors.sage[600],
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 8,
    shadowColor: colors.sage[900],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.sage[200],
  },
  dividerText: {
    fontSize: 13,
    color: colors.sage[400],
    fontWeight: "500",
  },
  secondaryBtn: {
    borderWidth: 1.5,
    borderColor: colors.sage[300],
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryBtnText: {
    color: colors.sage[700],
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    textAlign: "center",
    fontSize: 12,
    color: colors.sage[400],
    marginTop: 24,
    lineHeight: 18,
  },
})
