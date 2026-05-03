"use client"

import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"

export default function CommunityPage() {
  /* BLOG (Community) kısmı geçici olarak kapatıldı
  const { data: session } = useSession()
  const [posts, setPosts] = useState<any[]>([])
  ...
  */

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-sage-50 py-12">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h1 className="text-4xl font-display text-ink mb-4">
            Blog & Topluluk
          </h1>
          <p className="text-ink/60">Bu bölüm şu anda bakımdadır veya devre dışı bırakılmıştır.</p>
        </div>
      </div>
      <Footer />
    </>
  )
}
