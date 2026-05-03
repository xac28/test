import React from "react"
import { View, Text, StyleSheet } from "react-native"
import { colors } from "../../constants"

export default function MessagesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Messages</Text>
      <Text style={styles.text}>Direct messages are coming soon!</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.cream,
  },
  title: {
    fontFamily: "serif",
    fontSize: 28,
    color: colors.sage[900],
    marginBottom: 8,
  },
  text: {
    color: colors.sage[600],
    fontSize: 16,
  }
})
