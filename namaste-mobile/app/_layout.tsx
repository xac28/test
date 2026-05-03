import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { AuthProvider } from "../context/auth"

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#faf6f0" },
          animation: "slide_from_right",
        }}
      />
    </AuthProvider>
  )
}
