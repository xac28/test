"use client"

import { useEffect, useState } from "react"
import { getTeacher, Teacher } from "@/lib/teachers"

/** Demo teachers resolve instantly; database teachers are fetched by id. */
export function useTeacher(slug: string): { teacher: Teacher | undefined; loading: boolean } {
  const demo = getTeacher(slug)
  const [fetched, setFetched] = useState<Teacher | undefined>(undefined)
  const [loading, setLoading] = useState(!demo)

  useEffect(() => {
    if (demo) return
    let alive = true
    setLoading(true)
    fetch(`/api/teachers/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : undefined))
      .then((t) => alive && setFetched(t))
      .catch(() => {})
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [slug, demo])

  return { teacher: demo ?? fetched, loading }
}
