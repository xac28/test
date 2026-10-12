import { ViewerPage } from "@/components/live/viewer-page"

export const metadata = { title: "Canlı Yayın · AYA" }

export default async function WatchPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <ViewerPage liveRoomId={params.id} />
}
