import { API_BASE } from "../constants"

export type UploadKind = "avatar" | "video" | "certificate"

export interface PickedAsset {
  uri: string
  fileName?: string | null
  mimeType?: string | null
  type?: string | null
}

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm",
}

/**
 * Work out the MIME type + file name the server expects. Phone libraries often
 * give no mimeType, a bare "image"/"video", or a name without an extension.
 */
export function describeAsset(asset: PickedAsset, kind: UploadKind): { name: string; type: string } {
  const uriName = asset.uri.split("?")[0].split("/").pop() || ""
  const rawName = asset.fileName || uriName
  const ext = (/\.(\w{2,5})$/.exec(rawName)?.[1] || "").toLowerCase()

  let type = (asset.mimeType || "").toLowerCase()
  if (!type.includes("/")) type = EXT_MIME[ext] || ""
  if (!type) type = kind === "video" ? "video/mp4" : "image/jpeg"
  if (type === "image/jpg") type = "image/jpeg"

  const wantedExt = Object.entries(EXT_MIME).find(([, m]) => m === type)?.[0] || ext || "bin"
  const base = rawName.replace(/\.\w{2,5}$/, "") || `${kind}-${Date.now()}`
  return { name: `${base}.${wantedExt}`, type }
}

export interface UploadResult {
  /** server-relative path, e.g. /uploads/videos/video-….mp4 */
  url: string
  /** absolute URL usable in <Image>/<Video> */
  fullUrl: string
}

/**
 * Multipart upload to /api/upload with a Bearer token and progress reporting.
 * XMLHttpRequest is used because fetch() has no upload progress, and the
 * Content-Type header is left unset so the native layer adds the boundary.
 */
export function uploadAsset(opts: {
  token: string
  asset: PickedAsset
  kind: UploadKind
  onProgress?: (fraction: number) => void
}): Promise<UploadResult> {
  const { token, asset, kind, onProgress } = opts
  const { name, type } = describeAsset(asset, kind)

  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append("file", { uri: asset.uri, name, type } as any)
    form.append("type", kind)

    const xhr = new XMLHttpRequest()
    xhr.open("POST", `${API_BASE}/api/upload`)
    xhr.setRequestHeader("Authorization", `Bearer ${token}`)
    xhr.setRequestHeader("Accept", "application/json")
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total)
    }
    xhr.onerror = () => reject(new Error("Ağ hatası, yükleme tamamlanamadı"))
    xhr.ontimeout = () => reject(new Error("Yükleme zaman aşımına uğradı"))
    xhr.timeout = 15 * 60 * 1000
    xhr.onload = () => {
      let body: any = {}
      try {
        body = JSON.parse(xhr.responseText)
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && body.url) {
        resolve({ url: body.url, fullUrl: body.url.startsWith("http") ? body.url : `${API_BASE}${body.url}` })
      } else {
        reject(new Error(body.error || `Yükleme başarısız (HTTP ${xhr.status})`))
      }
    }
    xhr.send(form)
  })
}
