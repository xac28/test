import { UnsubscribeView } from "@/components/unsubscribe-view"

export const metadata = { title: "Bültenden ayrıl", robots: { index: false } }

export default async function UnsubscribePage(props: { searchParams: Promise<{ t?: string }> }) {
  const searchParams = await props.searchParams;
  return <UnsubscribeView token={typeof searchParams.t === "string" ? searchParams.t : ""} />
}
