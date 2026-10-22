// A template (unlike a layout) re-mounts on every navigation, which replays the page entrance.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-transition">{children}</div>
}
