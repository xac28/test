"use client"

import { useState, useRef } from "react"
import { Camera, Upload, X } from "lucide-react"

interface AvatarUploaderProps {
  currentImageUrl?: string | null
  onUploadSuccess: (url: string) => void
}

export function AvatarUploader({ currentImageUrl, onUploadSuccess }: AvatarUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)

    try {
      // 1. Create a local preview and resize via Canvas
      const resizedBlob = await resizeImage(file, 400, 400)
      const preview = URL.createObjectURL(resizedBlob)
      setPreviewUrl(preview)

      // 2. Upload to server
      const formData = new FormData()
      formData.append("file", resizedBlob, file.name || "avatar.jpg")
      formData.append("type", "avatar")

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        onUploadSuccess(data.url)
      } else {
        const data = await res.json()
        alert(data.error || "Failed to upload avatar")
      }
    } catch (err) {
      console.error(err)
      alert("Error processing image")
    } finally {
      setUploading(false)
    }
  }

  // Helper function to resize and crop image to square
  const resizeImage = (file: File, width: number, height: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement("canvas")
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext("2d")
          if (!ctx) return reject("Canvas not supported")

          // Calculate crop to maintain aspect ratio (cover)
          const scale = Math.max(width / img.width, height / img.height)
          const x = (width / scale - img.width) / 2
          const y = (height / scale - img.height) / 2

          ctx.drawImage(img, x, y, img.width, img.height, 0, 0, width, height)

          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob)
              else reject("Canvas toBlob failed")
            },
            "image/jpeg",
            0.9 // 90% quality
          )
        }
        img.onerror = reject
        if (event.target?.result) {
          img.src = event.target.result as string
        }
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative group">
        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-sage-200 bg-sage-50 shadow-sm relative">
          {previewUrl ? (
            <img src={previewUrl} alt="Avatar preview" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sage-300">
              <Camera size={40} />
            </div>
          )}
          
          {/* Uploading Overlay */}
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 bg-sage-100 text-sage-700 rounded-full text-sm font-medium hover:bg-sage-200 transition disabled:opacity-50"
        >
          <Upload size={16} />
          Upload Photo
        </button>

        {/* Capture from camera (works on mobile browsers) */}
        <button
          type="button"
          disabled={uploading}
          onClick={() => cameraInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 bg-sage-100 text-sage-700 rounded-full text-sm font-medium hover:bg-sage-200 transition disabled:opacity-50 md:hidden"
        >
          <Camera size={16} />
          Take Photo
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="user"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
      <p className="text-xs text-sage-400">JPEG, PNG or WebP. Max 10MB.</p>
    </div>
  )
}
