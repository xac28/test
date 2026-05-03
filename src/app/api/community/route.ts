import { NextResponse } from "next/server"

export async function GET(req: Request) {
  /* BLOG (Community) kısmı devre dışı bırakıldı
  const blocked = applyRateLimit(req, RATE_LIMIT_API)
  if (blocked) return blocked
  ...
  */
  return NextResponse.json({ error: "Blog section is disabled" }, { status: 403 })
}

export async function POST(req: Request) {
  /*
  ...
  */
  return NextResponse.json({ error: "Blog section is disabled" }, { status: 403 })
}
