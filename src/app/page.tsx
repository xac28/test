"use client"

import { useSession, signIn } from "next-auth/react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowRight, Video, Calendar, ShieldCheck, Star, Users, Globe, Sparkles, Menu, X } from "lucide-react"

export default function Home() {
  const { data: session } = useSession()
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-cream selection:bg-sage-200 selection:text-sage-900">
      {/* ─── NAVBAR ─── */}
      <nav className={`fixed w-full z-50 top-0 transition-all duration-500 ${scrolled ? "glass-card border-b border-sage-100/50 shadow-sm" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="font-display text-2xl tracking-widest text-sage-900 animate-scale-in">
            AYA
          </Link>
          <div className="hidden md:flex items-center gap-8 animate-slide-right">
            <Link href="/teachers" className="text-sage-700 hover:text-sage-900 font-medium transition hover:-translate-y-0.5 text-sm">
              Find Teachers
            </Link>
            <Link href="/become-teacher" className="text-sage-700 hover:text-sage-900 font-medium transition hover:-translate-y-0.5 text-sm">
              Teach with us
            </Link>
            {session ? (
              <Link
                href="/dashboard"
                className="bg-sage-600 text-white px-6 py-2.5 rounded-full hover:bg-sage-700 transition shadow-sm font-medium btn-press"
              >
                Dashboard
              </Link>
            ) : (
              <button
                onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                className="bg-sage-900 text-sage-50 px-6 py-2.5 rounded-full hover:bg-sage-800 transition shadow-sm font-medium btn-press"
              >
                Sign In
              </button>
            )}
          </div>
          {/* Mobile menu toggle */}
          <button className="md:hidden text-sage-700 p-2" onClick={() => setMobileMenu(!mobileMenu)}>
            {mobileMenu ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        {/* Mobile menu dropdown */}
        {mobileMenu && (
          <div className="md:hidden glass-card border-t border-sage-100/50 px-6 py-6 space-y-4 animate-slide-down">
            <Link href="/teachers" className="block text-sage-700 font-medium py-2" onClick={() => setMobileMenu(false)}>Find Teachers</Link>
            <Link href="/become-teacher" className="block text-sage-700 font-medium py-2" onClick={() => setMobileMenu(false)}>Teach with us</Link>
            {session ? (
              <Link href="/dashboard" className="block bg-sage-600 text-white px-6 py-3 rounded-full text-center font-medium" onClick={() => setMobileMenu(false)}>Dashboard</Link>
            ) : (
              <button onClick={() => signIn("google", { callbackUrl: "/dashboard" })} className="w-full bg-sage-900 text-sage-50 px-6 py-3 rounded-full font-medium">Sign In</button>
            )}
          </div>
        )}
      </nav>

      <main className="texture-overlay">
        {/* ─── HERO ─── */}
        <section className="relative pt-32 pb-24 md:pt-40 md:pb-32 overflow-hidden">
          {/* Background decorative elements */}
          <div className="absolute top-20 right-10 w-72 h-72 bg-sage-200/30 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-10 left-10 w-96 h-96 bg-clay-100/20 rounded-full blur-3xl" style={{ animationDelay: "2s" }} />

          <div className="max-w-7xl mx-auto px-6 text-center relative z-10 stagger-children">
            <div className="inline-flex items-center justify-center space-x-2 bg-sage-100/60 backdrop-blur-md text-sage-900 px-6 py-2.5 rounded-full mb-10 border border-sage-200 shadow-sm hover:bg-sage-100/80 transition-colors cursor-default">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sage-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sage-600"></span>
              </span>
              <span className="text-[13px] font-bold uppercase tracking-widest">Live 1-on-1 Practice</span>
            </div>
            <h1 className="text-6xl sm:text-7xl md:text-[7rem] font-display text-sage-900 mb-8 leading-[1.1] tracking-tight">
              Your practice,<br />anywhere you <span className="gradient-text italic pr-4">breathe</span>.
            </h1>
            <p className="text-lg md:text-2xl text-sage-600 mb-12 max-w-3xl mx-auto leading-relaxed font-light">
              Connect with certified yoga and meditation teachers worldwide for deeply personalized live sessions from the comfort of your home.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
              <button
                onClick={() => session ? window.location.href = "/teachers" : signIn("google", { callbackUrl: "/teachers" })}
                className="bg-sage-900 text-white px-10 py-5 rounded-full text-lg font-medium hover:bg-sage-800 transition-all shadow-[0_20px_40px_-15px_rgba(44,59,39,0.4)] hover:shadow-[0_20px_40px_-10px_rgba(44,59,39,0.6)] flex items-center gap-3 btn-press group hover:-translate-y-1"
              >
                Find Your Teacher <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <Link
                href="/become-teacher"
                className="bg-white/80 backdrop-blur-sm text-sage-900 px-10 py-5 rounded-full text-lg font-medium border border-sage-200 hover:border-sage-300 hover:bg-white hover:shadow-lg transition-all btn-press hover:-translate-y-1"
              >
                I am a Teacher
              </Link>
            </div>
          </div>
        </section>

        {/* ─── TRUST STATS ─── */}
        <section className="py-12 border-t border-b border-sage-200/50">
          <div className="max-w-5xl mx-auto px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center stagger-children">
              <div>
                <p className="text-3xl md:text-4xl font-display text-sage-900 animate-count">500+</p>
                <p className="text-sm text-sage-500 mt-1 font-medium">Certified Teachers</p>
              </div>
              <div>
                <p className="text-3xl md:text-4xl font-display text-sage-900 animate-count" style={{ animationDelay: "100ms" }}>10K+</p>
                <p className="text-sm text-sage-500 mt-1 font-medium">Live Sessions</p>
              </div>
              <div>
                <p className="text-3xl md:text-4xl font-display text-sage-900 animate-count" style={{ animationDelay: "200ms" }}>45+</p>
                <p className="text-sm text-sage-500 mt-1 font-medium">Countries</p>
              </div>
              <div>
                <p className="text-3xl md:text-4xl font-display text-sage-900 animate-count" style={{ animationDelay: "300ms" }}>4.9</p>
                <p className="text-sm text-sage-500 mt-1 font-medium">Avg Rating ⭐</p>
              </div>
            </div>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-6">
          {/* ─── FEATURES ─── */}
          <section className="py-24 stagger-children">
            <div className="text-center mb-16">
              <p className="text-sage-500 text-sm font-medium tracking-wider uppercase mb-3">Why AYA</p>
              <h2 className="text-3xl md:text-5xl font-display text-sage-900">Everything you need to <span className="italic gradient-text">grow</span></h2>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: Video, title: "HD Live Video", desc: "Crystal-clear 1080p video at 60fps with enterprise-grade LiveKit infrastructure. No lag, no interruptions.", color: "bg-sage-100 text-sage-700", border: "border-sage-200" },
                { icon: Calendar, title: "Smart Scheduling", desc: "Book sessions that fit your timezone. Instant confirmations with secure Stripe payments.", color: "bg-clay-100 text-clay-800", border: "border-clay-200" },
                { icon: ShieldCheck, title: "Verified Teachers", desc: "Every teacher is personally reviewed, certified and background-checked for your safety.", color: "bg-green-100 text-green-700", border: "border-green-200" },
                { icon: Globe, title: "Global Community", desc: "Practice with teachers from 45+ countries. Find the perfect match for your style.", color: "bg-blue-100 text-blue-700", border: "border-blue-200" },
                { icon: Sparkles, title: "Personalized Path", desc: "AI-enhanced session recommendations based on your goals, experience and preferences.", color: "bg-amber-100 text-amber-700", border: "border-amber-200" },
                { icon: Users, title: "1-on-1 Focus", desc: "No crowded classes. Get undivided attention with personalized corrections and guidance.", color: "bg-purple-100 text-purple-700", border: "border-purple-200" },
              ].map((feature, i) => (
                <div key={i} className="group card-hover p-8 rounded-[2rem] bg-white/60 backdrop-blur-sm border border-sage-100/50 hover:bg-white hover:shadow-xl hover:shadow-sage-900/5 transition-all duration-500 relative overflow-hidden">
                  <div className={`absolute -right-6 -top-6 w-32 h-32 rounded-full opacity-20 blur-2xl ${feature.color} transition-transform duration-700 group-hover:scale-150`}></div>
                  <div className={`w-14 h-14 ${feature.color} border ${feature.border} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 relative z-10 shadow-sm`}>
                    <feature.icon size={26} />
                  </div>
                  <h3 className="text-2xl font-display text-sage-900 mb-3 relative z-10">{feature.title}</h3>
                  <p className="text-sage-600 text-[15px] leading-relaxed relative z-10">{feature.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ─── HOW IT WORKS ─── */}
          <section id="how-it-works" className="py-24 border-t border-sage-200/50 stagger-children">
            <div className="text-center mb-16">
              <p className="text-sage-500 text-sm font-medium tracking-wider uppercase mb-3">Simple & Seamless</p>
              <h2 className="text-3xl md:text-5xl font-display text-sage-900">How it <span className="italic gradient-text">works</span></h2>
            </div>
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {[
                { step: "01", title: "Find Your Teacher", desc: "Browse profiles, read reviews, and pick the teacher that resonates with you." },
                { step: "02", title: "Book a Session", desc: "Choose a time slot in your timezone and complete payment securely." },
                { step: "03", title: "Practice Live", desc: "Join the HD video room and enjoy a personalized, transformative session." },
              ].map((item, i) => (
                <div key={i} className="text-center group">
                  <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-sage-100 flex items-center justify-center text-sage-600 font-display text-xl group-hover:bg-sage-600 group-hover:text-white transition-all duration-300">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-display text-sage-900 mb-3">{item.title}</h3>
                  <p className="text-sage-600 text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ─── TESTIMONIALS ─── */}
          <section className="py-24 border-t border-sage-200/50 stagger-children">
            <div className="text-center mb-16">
              <p className="text-sage-500 text-sm font-medium tracking-wider uppercase mb-3">Loved by thousands</p>
              <h2 className="text-3xl md:text-5xl font-display text-sage-900">What our community <span className="italic gradient-text">says</span></h2>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { name: "Sarah M.", location: "London, UK", text: "AYA transformed my practice. Having a dedicated teacher who knows my strengths and challenges makes all the difference.", stars: 5 },
                { name: "Ahmet K.", location: "Istanbul, TR", text: "The video quality is incredible — it truly feels like being in the same room. I've been practicing daily for 6 months now.", stars: 5 },
                { name: "Maria L.", location: "São Paulo, BR", text: "As a teacher, this platform gave me the freedom to teach globally while maintaining deep, personal connections with my students.", stars: 5 },
              ].map((review, i) => (
                <div key={i} className="glass-card p-8 rounded-3xl border border-sage-100/50 card-hover">
                  <div className="flex gap-0.5 mb-4">
                    {[...Array(review.stars)].map((_, j) => (
                      <Star key={j} size={16} className="text-yellow-500 fill-yellow-500" />
                    ))}
                  </div>
                  <p className="text-sage-700 mb-6 leading-relaxed text-sm italic font-display text-lg">"{review.text}"</p>
                  <div>
                    <p className="font-semibold text-sage-900 text-sm">{review.name}</p>
                    <p className="text-sage-500 text-xs">{review.location}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ─── CTA ─── */}
          <section className="py-24 stagger-children">
            <div className="relative bg-sage-900 rounded-[2rem] p-12 md:p-20 text-center overflow-hidden">
              <div className="absolute inset-0 opacity-10" style={{
                backgroundImage: `radial-gradient(circle at 20% 50%, rgba(174, 195, 157, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(214, 179, 148, 0.3) 0%, transparent 50%)`
              }} />
              <div className="relative z-10">
                <h2 className="text-3xl md:text-5xl font-display text-white mb-6">Ready to begin your <span className="italic text-sage-300">journey</span>?</h2>
                <p className="text-sage-400 mb-10 max-w-xl mx-auto text-lg">Join thousands of practitioners who have transformed their lives through personalized yoga and meditation.</p>
                <button
                  onClick={() => session ? window.location.href = "/teachers" : signIn("google", { callbackUrl: "/teachers" })}
                  className="bg-white text-sage-900 px-10 py-4 rounded-full text-lg font-medium hover:bg-sage-50 transition-all shadow-lg hover:shadow-xl btn-press group inline-flex items-center gap-2"
                >
                  Start Your Practice <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* ─── FOOTER ─── */}
        <footer className="bg-sage-900 text-sage-400 mt-12">
          <div className="max-w-7xl mx-auto px-6 py-16">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
              <div className="col-span-2 md:col-span-1">
                <p className="font-display text-2xl tracking-widest text-white mb-4">AYA</p>
                <p className="text-sage-500 text-sm leading-relaxed">Your practice, anywhere you breathe. Live 1-on-1 yoga with certified teachers worldwide.</p>
              </div>
              <div>
                <h4 className="text-white font-medium mb-4 text-sm uppercase tracking-wider">Students</h4>
                <ul className="space-y-2.5 text-sm">
                  <li><Link href="/teachers" className="hover:text-white transition-colors">Find a Teacher</Link></li>
                  <li><Link href="/dashboard" className="hover:text-white transition-colors">My Dashboard</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-medium mb-4 text-sm uppercase tracking-wider">Teachers</h4>
                <ul className="space-y-2.5 text-sm">
                  <li><Link href="/become-teacher" className="hover:text-white transition-colors">Apply to Teach</Link></li>
                  <li><Link href="/teach" className="hover:text-white transition-colors">Teacher Portal</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-medium mb-4 text-sm uppercase tracking-wider">Company</h4>
                <ul className="space-y-2.5 text-sm">
                  <li><Link href="/" className="hover:text-white transition-colors">About Us</Link></li>
                  <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                  <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
                </ul>
              </div>
            </div>
            <div className="pt-8 border-t border-sage-800 text-xs text-sage-600 flex flex-col md:flex-row justify-between items-center gap-4">
              <p>© {new Date().getFullYear()} AYA. All rights reserved.</p>
              <p className="font-display italic text-sage-500">Built with 🙏 for the global yoga community</p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}
