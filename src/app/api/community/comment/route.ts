import { NextResponse } from "next/server"

export async function POST(req: Request) {
  /* BLOG (Community) yorum kısmı devre dışı bırakıldı
  ...
  */
  return NextResponse.json({ error: "Blog comments are disabled" }, { status: 403 })
}
