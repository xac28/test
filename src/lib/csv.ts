/** Minimal CSV writer. Cells that start with = + - @ are prefixed so spreadsheets never run them as formulas. */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ""
  let s = v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  // BOM so Excel opens Turkish characters correctly
  return "﻿" + [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n"
}

export function csvResponse(name: string, body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
