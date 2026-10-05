import { MonitorView } from "@/components/admin/monitor-view"

export const metadata = { title: "Canlı izleme · AYA" }
export const dynamic = "force-dynamic"

export default function MonitorPage({ params }: { params: { id: string } }) {
  return <MonitorView liveRoomId={params.id} />
}
