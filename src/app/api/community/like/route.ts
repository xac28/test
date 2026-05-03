import { NextResponse } from "next/server"

export async function POST(req: Request) {
  /* BLOG (Community) beğeni kısmı devre dışı bırakıldı
  ...
  */
  return NextResponse.json({ error: "Blog likes are disabled" }, { status: 403 })
}
