import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { CtaBand, PageHero } from "@/components/marketing"
import PoseLibrary from "@/components/poses/pose-library"
import { POSES } from "@/lib/yoga-poses"

export const metadata = { title: "Yoga pozları", description: "Başlangıçtan ileri seviyeye yoga pozları: nasıl yapılır, faydaları, nefes ve dikkat edilecekler. Her poz 3B olarak döndürülebilir." }

export default function PosesPage() {
  return (
    <>
      <Navbar />
      <main>
        <PageHero eyebrow="Poz kütüphanesi" title="Her pozu" accent="adım adım öğren." lead={`${POSES.length} yoga pozu: nasıl yapılır, hangi kasları çalıştırır, nefes nasıl olmalı ve kimler dikkat etmeli. Her pozu 3 boyutlu olarak çevirip her açıdan inceleyebilirsin.`} />
        <section className="max-w-7xl mx-auto px-6 lg:px-12 py-14"><PoseLibrary /></section>
        <CtaBand title="Pozları bir eğitmenle birlikte yap." text="Doğru hizalama için canlı geri bildirim en iyi öğretmendir. İlk deneme dersi yarı fiyat." href="/teachers" label="Eğitmen bul" secondary={{ href: "/yoga-stilleri", label: "Yoga stillerini keşfet" }} />
      </main>
      <Footer />
    </>
  )
}
