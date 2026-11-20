import { auth } from "@/auth"
import { CheckoutView } from "@/components/shop-pages"
import { iyzicoMode } from "@/lib/iyzico"

export const dynamic = "force-dynamic"
export const metadata = { title: "Siparişi tamamla · Shop" }

export default async function CheckoutPage() {
  const session = await auth().catch(() => null)
  return <CheckoutView defaults={{ name: session?.user?.name ?? "", email: session?.user?.email ?? "" }} card={iyzicoMode() !== "off"} />
}
