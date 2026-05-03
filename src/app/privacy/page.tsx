import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import LanguagePicker from "@/components/LanguagePicker"

export default function PrivacyPage() {
  return (
    <>
      <LanguagePicker />
      <Navbar />
      <main className="min-h-screen bg-cream py-24">
        <div className="max-w-3xl mx-auto px-6">
          <h1 className="font-display text-4xl text-sage-900 mb-8">Privacy Policy</h1>
          <div className="prose prose-sage max-w-none text-sage-700 space-y-6">
            <p>Last updated: {new Date().toLocaleDateString()}</p>
            <p>At Namaste, we take your privacy seriously. This Privacy Policy explains how we collect, use, and protect your personal information when you use our platform.</p>
            
            <h2 className="text-2xl font-display text-sage-800 mt-8 mb-4">1. Information We Collect</h2>
            <p>We collect information you provide directly to us, such as when you create an account, update your profile, apply to be a teacher, or contact customer support. This may include your name, email address, phone number, date of birth, and identity documents (for teachers).</p>
            
            <h2 className="text-2xl font-display text-sage-800 mt-8 mb-4">2. How We Use Your Information</h2>
            <p>We use the information we collect to operate our platform, process transactions, verify teacher credentials, provide customer support, and communicate with you about your account.</p>

            <h2 className="text-2xl font-display text-sage-800 mt-8 mb-4">3. Camera and Microphone Data</h2>
            <p>During live sessions, audio and video data is processed in real-time through our secure LiveKit servers. We do not record or store your private sessions without explicit consent from all parties.</p>

            <h2 className="text-2xl font-display text-sage-800 mt-8 mb-4">4. Third-Party Services</h2>
            <p>We use third-party services like Stripe for payment processing and Google for authentication. These services have their own privacy policies.</p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
