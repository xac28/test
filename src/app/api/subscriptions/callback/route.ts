import { NextResponse } from "next/server"
import { SITE_URL } from "@/lib/site"
import { completeSubscriptionCheckout } from "@/lib/subscription-server"

export const dynamic = "force-dynamic"

const back = (result: string) => NextResponse.redirect(`${SITE_URL}/dashboard/uyelik?odeme=${result}`, 303)

/** iyzico sends the member back here with the form token; the outcome is read from iyzico, never from the browser. */
export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const token = String(form.get("token") ?? "").trim()
    if (!token) return back("hata")
    const r = await completeSubscriptionCheckout(token)
    return back(r.ok ? "ok" : r.reason === "declined" ? "red" : "hata")
  } catch (e) {
    console.error("[SUB_CALLBACK]", e)
    return back("hata")
  }
}
