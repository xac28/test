import { API_BASE } from "../constants"

export interface ApiResult<T> {
  ok: boolean
  status: number
  data: T
}

/** fetch against the AYA server: JSON in/out, Bearer token when signed in, never throws (network problems come back as status 0). */
export async function api<T = any>(path: string, opts: { token?: string | null; method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: opts.method || (opts.body !== undefined ? "POST" : "GET"),
      headers: {
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, status: res.status, data }
  } catch {
    return { ok: false, status: 0, data: { error: "Sunucuya ulaşılamadı. İnternet bağlantını kontrol et." } as any }
  }
}
