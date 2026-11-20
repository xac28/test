import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"

/** Shared frame for the small account pages (forgot / reset password). */
export function AuthCard({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="min-h-[70vh] bg-gradient-to-br from-clay-50 via-cream to-teal-50 px-6 py-16 flex items-start justify-center">
        <div className="w-full max-w-md bg-paper border border-rule rounded-3xl shadow-lg p-8 md:p-10">
          <h1 className="font-display text-4xl leading-tight">{title}</h1>
          {lead && <p className="mt-3 text-sage-600 leading-relaxed">{lead}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
      <Footer />
    </>
  )
}
