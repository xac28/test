"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { Box, Image as ImageIcon } from "lucide-react"
import { poseImage } from "@/lib/yoga-poses"

const PoseViewer = dynamic(() => import("@/components/three/pose-viewer").then((m) => m.PoseViewer), { ssr: false, loading: () => <div className="absolute inset-0" aria-hidden /> })

/** The pose picture with a switch to an interactive 3D view (loaded only on request: the model is ~3 MB). */
export function Pose3D({ slug, name }: { slug: string; name: string }) {
  const [mode, setMode] = useState<"image" | "3d">("image")
  return (
    <div>
      <div className="relative aspect-[4/5] rounded-3xl overflow-hidden bg-gradient-to-br from-clay-100 to-teal-100 border border-rule shadow-lg">
        {mode === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poseImage(slug)} alt={`${name} duruşu`} className="absolute inset-0 w-full h-full object-cover" data-testid="pose-image" />
        ) : (
          <PoseViewer slug={slug} className="absolute inset-0" />
        )}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1 p-1 rounded-full bg-paper/90 backdrop-blur shadow-md text-sm font-semibold" role="tablist">
          <button role="tab" aria-selected={mode === "image"} onClick={() => setMode("image")} className={`px-4 py-2 min-h-[40px] rounded-full whitespace-nowrap inline-flex items-center gap-1.5 ${mode === "image" ? "bg-ink text-cream" : "text-sage-700"}`}><ImageIcon size={15} /> Görsel</button>
          <button role="tab" aria-selected={mode === "3d"} onClick={() => setMode("3d")} data-testid="pose-3d-toggle" className={`px-4 py-2 min-h-[40px] rounded-full whitespace-nowrap inline-flex items-center gap-1.5 ${mode === "3d" ? "bg-ink text-cream" : "text-sage-700"}`}><Box size={15} /> 3B döndür</button>
        </div>
      </div>
      {mode === "3d" && <p className="text-xs text-sage-500 mt-2 text-center">Sürükleyerek döndür, kaydırarak yakınlaştır.</p>}
    </div>
  )
}
