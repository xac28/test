import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import * as SecureStore from "expo-secure-store"
import { API_BASE } from "../constants"

interface User {
  id: string
  name: string | null
  email: string | null
  image: string | null
  role: "STUDENT" | "TEACHER" | "ADMIN"
}

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signUp: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  signIn: async () => ({ success: false }),
  signUp: async () => ({ success: false }),
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Restore session on app start
  useEffect(() => {
    const restore = async () => {
      try {
        const savedToken = await SecureStore.getItemAsync("auth_token")
        if (savedToken) {
          const res = await fetch(`${API_BASE}/api/mobile/me`, {
            headers: { Authorization: `Bearer ${savedToken}` },
          })
          if (res.ok) {
            const data = await res.json()
            setUser(data.user)
            setToken(savedToken)
          } else {
            await SecureStore.deleteItemAsync("auth_token")
          }
        }
      } catch (e) {
        console.error("Auth restore error:", e)
      } finally {
        setIsLoading(false)
      }
    }
    restore()
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/mobile/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (res.ok && data.token) {
        await SecureStore.setItemAsync("auth_token", data.token)
        setToken(data.token)
        setUser(data.user)
        return { success: true }
      }

      return { success: false, error: data.error || "Login failed" }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }

  const signUp = async (name: string, email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/mobile/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      })

      const data = await res.json()

      if (res.ok && data.token) {
        await SecureStore.setItemAsync("auth_token", data.token)
        setToken(data.token)
        setUser(data.user)
        return { success: true }
      }

      return { success: false, error: data.error || "Registration failed" }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }

  const signOut = async () => {
    await SecureStore.deleteItemAsync("auth_token")
    setUser(null)
    setToken(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
