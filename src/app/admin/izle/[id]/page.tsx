import { MonitorView } from "@/components/admin/monitor-view"

export const metadata = { title: "Canlı izleme · AYA" }
export const dynamic = "force-dynamic"

export default async function MonitorPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <MonitorView liveRoomId={params.id} />
}
