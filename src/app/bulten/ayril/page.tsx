import { UnsubscribeView } from "@/components/unsubscribe-view"

export const metadata = { title: "Bültenden ayrıl", robots: { index: false } }

export default function UnsubscribePage({ searchParams }: { searchParams: { t?: string } }) {
  return <UnsubscribeView token={typeof searchParams.t === "string" ? searchParams.t : ""} />
}
