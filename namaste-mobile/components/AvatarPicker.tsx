import React, { useState } from "react"
import { View, Image, TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert } from "react-native"
import * as ImagePicker from "expo-image-picker"
import { API_BASE } from "../constants"
import { useAuth } from "../context/auth"
import { uploadAsset } from "../lib/upload"

interface AvatarPickerProps {
  currentImageUrl?: string | null
  onUploadSuccess: (url: string) => void
}

export const AvatarPicker: React.FC<AvatarPickerProps> = ({ currentImageUrl, onUploadSuccess }) => {
  const { token } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [previewUri, setPreviewUri] = useState<string | null>(currentImageUrl || null)

  const ensurePermission = async (useCamera: boolean) => {
    const res = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (res.status !== "granted") {
      Alert.alert("İzin gerekli", useCamera ? "Kamera izni vermelisiniz." : "Galeri izni vermelisiniz.")
      return false
    }
    return true
  }

  const handlePickImage = async (useCamera: boolean) => {
    if (!(await ensurePermission(useCamera))) return

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8, // JPEG-encoded, so iOS HEIC photos are converted
    }
    const result = useCamera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options)
    if (result.canceled || !result.assets?.length) return

    const asset = result.assets[0]
    const previous = previewUri
    setPreviewUri(asset.uri)
    if (!token) {
      Alert.alert("Hata", "Oturum bulunamadı")
      setPreviewUri(previous)
      return
    }

    setUploading(true)
    try {
      const uploaded = await uploadAsset({ token, asset, kind: "avatar" })
      onUploadSuccess(uploaded.fullUrl)
    } catch (e: any) {
      setPreviewUri(previous)
      Alert.alert("Yükleme başarısız", e?.message || "Fotoğraf yüklenemedi")
    } finally {
      setUploading(false)
    }
  }

  const shown = previewUri
    ? previewUri.startsWith("http") || previewUri.startsWith("file") || previewUri.startsWith("content") || previewUri.startsWith("ph:")
      ? previewUri
      : `${API_BASE}${previewUri}`
    : null

  return (
    <View style={styles.container}>
      <View style={styles.imageContainer}>
        {shown ? (
          <Image source={{ uri: shown }} style={styles.image} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>Fotoğraf yok</Text>
          </View>
        )}
        {uploading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#ffffff" />
          </View>
        )}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity testID="avatar-gallery" style={[styles.button, styles.buttonOutline]} onPress={() => handlePickImage(false)} disabled={uploading}>
          <Text style={styles.buttonOutlineText}>Galeri</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="avatar-camera" style={[styles.button, styles.buttonPrimary]} onPress={() => handlePickImage(true)} disabled={uploading}>
          <Text style={styles.buttonPrimaryText}>Kamera</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { alignItems: "center", marginVertical: 20 },
  imageContainer: {
    width: 120, height: 120, borderRadius: 60, overflow: "hidden", backgroundColor: "#e2e8f0",
    borderWidth: 3, borderColor: "#7f9c96", position: "relative", marginBottom: 16,
  },
  image: { width: "100%", height: "100%" },
  placeholder: { width: "100%", height: "100%", justifyContent: "center", alignItems: "center", backgroundColor: "#f1f5f9" },
  placeholderText: { color: "#94a3b8", fontSize: 12 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  buttonRow: { flexDirection: "row", gap: 12 },
  button: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, minWidth: 100, alignItems: "center" },
  buttonOutline: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#7f9c96" },
  buttonOutlineText: { color: "#7f9c96", fontWeight: "600" },
  buttonPrimary: { backgroundColor: "#7f9c96" },
  buttonPrimaryText: { color: "#ffffff", fontWeight: "600" },
})
