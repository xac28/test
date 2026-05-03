import React from "react"
import { Tabs, Redirect } from "expo-router"
import { Platform, Text } from "react-native"
import { colors } from "../../constants"
import { useAuth } from "../../context/auth"

export default function TabLayout() {
  const { user } = useAuth()

  if (!user) {
    return <Redirect href="/" />
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.sage[700],
        tabBarInactiveTintColor: colors.sage[300],
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopWidth: 1,
          borderTopColor: colors.sage[100],
          elevation: 10,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.05,
          shadowRadius: 10,
          height: Platform.OS === "ios" ? 85 : 70,
          paddingBottom: Platform.OS === "ios" ? 25 : 10,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontFamily: "serif",
          fontSize: 11,
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Practice",
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size - 4, color }}>🧘</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="teachers"
        options={{
          title: "Teachers",
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size - 4, color }}>🔍</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: "Sangha",
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size - 4, color }}>✨</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size - 4, color }}>💬</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size - 4, color }}>👤</Text>
          ),
        }}
      />
    </Tabs>
  )
}
