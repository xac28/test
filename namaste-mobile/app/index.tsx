import React, { useEffect, useRef, useState } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, ImageBackground, Dimensions } from "react-native"
import { useRouter, Redirect } from "expo-router"
import { useAuth } from "../context/auth"
import { colors } from "../constants"
import { StatusBar } from "expo-status-bar"
import { LinearGradient } from "expo-linear-gradient"

const { width } = Dimensions.get("window")

const ONBOARDING_DATA = [
  {
    image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=1200&auto=format&fit=crop",
    title: "Nefes al.",
    subtitle: "Gelişim ve huzur için kişisel sığınağın.",
  },
  {
    image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=1200&auto=format&fit=crop",
    title: "Bağlan.",
    subtitle: "Dünya çapında eğitmenlerle birebir canlı dersler.",
  },
  {
    image: "https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?q=80&w=1200&auto=format&fit=crop",
    title: "Dönüş.",
    subtitle: "Her yerde, her an pratik yap. Yolculuğun burada başlıyor.",
  }
]

export default function WelcomeScreen() {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [activeIndex, setActiveIndex] = useState(0)
  
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 1000,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
    ]).start()

    // Auto slide
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % ONBOARDING_DATA.length)
    }, 4000)

    return () => clearInterval(interval)
  }, [])

  if (isLoading) return null // Hide while checking auth

  if (user) {
    // Terms gate: accounts that have not accepted the current terms must do so first
    return <Redirect href={user.termsAccepted === false ? "/accept-terms" : "/(tabs)"} />
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {ONBOARDING_DATA.map((item, index) => (
        <Animated.View 
          key={index} 
          style={[
            StyleSheet.absoluteFillObject,
            { opacity: activeIndex === index ? 1 : 0 }
          ]}
        >
          <ImageBackground source={{ uri: item.image }} style={styles.image} blurRadius={activeIndex === index ? 0 : 10}>
            <LinearGradient
              colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.9)']}
              style={StyleSheet.absoluteFillObject}
            />
          </ImageBackground>
        </Animated.View>
      ))}

      <View style={styles.contentContainer}>
        <Animated.View style={[styles.textContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.brand}>AYA</Text>
          
          <View style={{ height: 120, justifyContent: 'center' }}>
            <Text style={styles.title}>{ONBOARDING_DATA[activeIndex].title}</Text>
            <Text style={styles.subtitle}>{ONBOARDING_DATA[activeIndex].subtitle}</Text>
          </View>

          <View style={styles.pagination}>
            {ONBOARDING_DATA.map((_, i) => (
              <View key={i} style={[styles.dot, activeIndex === i && styles.dotActive]} />
            ))}
          </View>
        </Animated.View>

        <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
          <TouchableOpacity 
            style={styles.primaryButton}
            activeOpacity={0.8}
            onPress={() => router.push("/login")}
          >
            <Text style={styles.primaryButtonText}>Başla</Text>
          </TouchableOpacity>
          
          <View style={styles.secondaryContainer}>
            <Text style={styles.secondaryText}>AYA'ya yeni misin? </Text>
            <TouchableOpacity onPress={() => router.push("/register")} hitSlop={{top:10,bottom:10,left:10,right:10}}>
              <Text style={styles.secondaryLink}>Hesap oluştur</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  contentContainer: {
    flex: 1,
    justifyContent: "space-between",
    paddingTop: 80,
    paddingBottom: 50,
  },
  textContainer: {
    paddingHorizontal: 30,
    marginTop: 40,
  },
  brand: {
    fontFamily: "serif",
    fontSize: 16,
    letterSpacing: 8,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 40,
    textAlign: "center",
  },
  title: {
    fontFamily: "serif",
    fontSize: 48,
    color: '#fff',
    marginBottom: 10,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 26,
    letterSpacing: 0.5,
  },
  pagination: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 30,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 24,
  },
  footer: {
    paddingHorizontal: 30,
    gap: 24,
  },
  primaryButton: {
    backgroundColor: colors.white,
    borderRadius: 50,
    paddingVertical: 18,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  primaryButtonText: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  secondaryContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
  },
  secondaryLink: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "700",
  },
})
