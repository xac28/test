import { ViewerPage } from "@/components/live/viewer-page"

export const metadata = { title: "Canlı Yayın · AYA" }

export default function WatchPage({ params }: { params: { id: string } }) {
  return <ViewerPage liveRoomId={params.id} />
}
