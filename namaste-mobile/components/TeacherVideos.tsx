import React, { useCallback, useEffect, useState } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Switch } from "react-native"
import * as ImagePicker from "expo-image-picker"
import { API_BASE, colors } from "../constants"
import { useAuth } from "../context/auth"
import { uploadAsset } from "../lib/upload"

interface VideoItem {
  id: string
  title: string
  videoUrl: string
  isPublic: boolean
}

/** Teacher-only: pick a video from the phone (or record one), upload it, and list/delete own videos. */
export function TeacherVideos() {
  const { token } = useAuth()
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [title, setTitle] = useState("")
  const [isPublic, setIsPublic] = useState(true)
  const [progress, setProgress] = useState<number | null>(null)

  const authHeaders = { Authorization: `Bearer ${token}` }

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/teacher/videos`, { headers: authHeaders })
      if (res.ok) setVideos((await res.json()).videos)
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const pickAndUpload = async (useCamera: boolean) => {
    if (!title.trim()) {
      Alert.alert("Başlık gerekli", "Önce videoya bir başlık yazın.")
      return
    }
    const perm = useCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (perm.status !== "granted") {
      Alert.alert("İzin gerekli", useCamera ? "Kamera izni vermelisiniz." : "Galeri izni vermelisiniz.")
      return
    }

    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["videos"], videoMaxDuration: 600, quality: 1 }
    const result = useCamera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options)
    if (result.canceled || !result.assets?.length || !token) return

    setProgress(0)
    try {
      const uploaded = await uploadAsset({ token, asset: result.assets[0], kind: "video", onProgress: setProgress })
      const res = await fetch(`${API_BASE}/api/teacher/videos`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), videoUrl: uploaded.url, isPublic }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Video kaydedilemedi")
      setTitle("")
      await load()
      Alert.alert("Hazır", "Videonuz yüklendi.")
    } catch (e: any) {
      Alert.alert("Yükleme başarısız", e?.message || "Video yüklenemedi")
    } finally {
      setProgress(null)
    }
  }

  const remove = (v: VideoItem) => {
    Alert.alert("Videoyu sil", `“${v.title}” silinsin mi?`, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          await fetch(`${API_BASE}/api/teacher/videos/${v.id}`, { method: "DELETE", headers: authHeaders })
          load()
        },
      },
    ])
  }

  const uploading = progress !== null

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Videolarım</Text>

      <TextInput testID="video-title" style={styles.input} placeholder="Video başlığı" value={title} onChangeText={setTitle} editable={!uploading} />
      <View style={styles.row}>
        <Text style={styles.label}>Herkese açık</Text>
        <Switch value={isPublic} onValueChange={setIsPublic} disabled={uploading} />
      </View>

      {uploading ? (
        <View style={styles.progress}>
          <ActivityIndicator color={colors.sage[600]} />
          <Text style={styles.progressText}>Yükleniyor… %{Math.round((progress || 0) * 100)}</Text>
        </View>
      ) : (
        <View style={styles.row}>
          <TouchableOpacity testID="video-gallery" style={[styles.btn, styles.btnOutline]} onPress={() => pickAndUpload(false)}>
            <Text style={styles.btnOutlineText}>Galeriden seç</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="video-camera" style={styles.btn} onPress={() => pickAndUpload(true)}>
            <Text style={styles.btnText}>Video çek</Text>
          </TouchableOpacity>
        </View>
      )}

      {videos.map((v) => (
        <View key={v.id} style={styles.item}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle}>{v.title}</Text>
            <Text style={styles.itemMeta}>{v.isPublic ? "Herkese açık" : "Yalnızca öğrencilere"}</Text>
          </View>
          <TouchableOpacity onPress={() => remove(v)}>
            <Text style={styles.delete}>Sil</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 16, gap: 12, borderWidth: 1, borderColor: colors.sage[100], marginTop: 24 },
  title: { fontFamily: "serif", fontSize: 20, color: colors.sage[900] },
  input: { borderWidth: 1, borderColor: colors.sage[200], borderRadius: 12, padding: 12, fontSize: 15, color: colors.ink },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  label: { color: colors.sage[700], fontSize: 14 },
  btn: { flex: 1, backgroundColor: colors.sage[600], borderRadius: 24, paddingVertical: 12, alignItems: "center" },
  btnText: { color: colors.white, fontWeight: "700" },
  btnOutline: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.sage[500] },
  btnOutlineText: { color: colors.sage[700], fontWeight: "700" },
  progress: { flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center", paddingVertical: 8 },
  progressText: { color: colors.sage[700] },
  item: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.sage[100] },
  itemTitle: { color: colors.ink, fontWeight: "600" },
  itemMeta: { color: colors.sage[500], fontSize: 12 },
  delete: { color: colors.red, fontWeight: "600" },
})
