'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import LanguagePicker from '@/components/LanguagePicker';
import { useI18n } from '@/i18n';
import { useTeacher } from '@/lib/use-teacher';
import { formatLocalPrice, formatUSD, localCurrencyCode } from '@/lib/currency';
import { formatLocalDate, formatLocalTime, userTimezone } from '@/lib/time';

function CheckoutInner() {
  const params = useSearchParams();
  const { t, locale } = useI18n();
  const [success, setSuccess] = useState(false);
  const [iyzicoHtml, setIyzicoHtml] = useState<string | null>(null);

  const teacherSlug = params.get('teacher') ?? '';
  const slot = params.get('slot') ?? '';
  const type = (params.get('type') as 'trial' | 'regular') ?? 'trial';

  const { teacher, loading } = useTeacher(teacherSlug);
  const [currency, setCurrency] = useState('USD');
  useEffect(() => setCurrency(localCurrencyCode()), []);
  const [paying, setPaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'iyzico'>('stripe');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  if (!teacher && loading) {
    return <div className="max-w-3xl mx-auto px-6 py-24 text-center text-sage-500">…</div>;
  }
  if (!teacher) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center">
        <h1 className="font-display text-3xl text-ink mb-4">Booking not found</h1>
        <Link href="/teachers" className="text-sage-700 underline">Back to teachers</Link>
      </div>
    );
  }

  const priceUSD = type === 'trial' ? teacher.trialPriceUSD : teacher.pricePerClassUSD;

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms) {
      alert("Sözleşmeyi kabul etmeniz gerekmektedir. / You must agree to the Terms of Service.");
      return;
    }
    setPaying(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherSlug: teacher.slug,
          slot,
          type,
          price: priceUSD,
          paymentProvider: paymentMethod,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        
        if (data.requiresIyzico) {
          const iyzRes = await fetch("/api/iyzico/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookingId: data.bookingId }),
          });
          const iyzData = await iyzRes.json();
          if (iyzData.success) {
            setIyzicoHtml(iyzData.htmlContent);
            return;
          } else {
            alert(iyzData.error || "Iyzico initialization failed");
          }
        } else if (data.stripeUrl) {
          window.location.href = data.stripeUrl;
        } else {
          setSuccess(true);
        }
      } else {
        const data = await res.json();
        alert(data.error || "Payment failed");
      }
    } catch {
      alert("Network error — please try again");
      setPaying(false);
    } finally {
      setPaying(false);
    }
  };

  if (success) {
    return (
      <section className="min-h-[70vh] flex items-center justify-center bg-cream py-20">
        <div className="max-w-md mx-auto text-center px-6">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-sage-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-sage-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="font-display text-4xl text-ink mb-3">Booking confirmed</h1>
          <p className="text-ink/70 mb-2">
            {teacher.name} · {formatLocalDate(slot, locale)}
          </p>
          <p className="text-ink/70 mb-8">
            {formatLocalTime(slot, locale)} ({userTimezone()})
          </p>
          <p className="text-sm text-ink/50 mb-8 italic font-display">
            Your session is confirmed and ready. See you on AYA. 🙏
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 bg-sage-700 hover:bg-sage-800 text-cream px-6 py-3 rounded-full font-medium"
            >
              Go to Dashboard →
            </Link>
            <Link
              href="/teachers"
              className="text-sage-600 hover:text-sage-800 text-sm font-medium transition"
            >
              Browse more teachers
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-sage-50 py-12 lg:py-16 min-h-[70vh]">
      <div className="max-w-5xl mx-auto px-6 lg:px-12">
        <Link href={`/teachers/${teacher.slug}`} className="text-sm text-ink/60 hover:text-sage-700 inline-flex items-center gap-1.5 mb-6">
          <span>←</span> {t.common.back}
        </Link>

        <h1 className="font-display text-4xl text-ink mb-8">{t.checkout.title}</h1>

        {iyzicoHtml ? (
          <div className="bg-white rounded-3xl p-8 border border-sage-200 shadow-xl animate-fade-in">
            <h2 className="text-xl font-display mb-6">Secure Payment / Güvenli Ödeme</h2>
            <div id="iyzipay-checkout-form" className="responsive" dangerouslySetInnerHTML={{ __html: iyzicoHtml }} />
            <button 
              onClick={() => setIyzicoHtml(null)}
              className="mt-8 text-sm text-sage-500 hover:text-sage-800 underline"
            >
              Cancel and change payment method
            </button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-5 gap-8">
          {/* Left: payment form (mock) */}
          <div className="lg:col-span-3">
            <form onSubmit={handlePay} className="bg-cream rounded-3xl border border-sage-100 p-6 lg:p-8 space-y-6">
              
              <div className="space-y-3">
                <label className="text-xs uppercase tracking-wide text-ink/50 block">Payment Method / Ödeme Yöntemi</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`cursor-pointer flex items-center gap-3 p-4 rounded-xl border ${paymentMethod === 'stripe' ? 'border-sage-600 bg-sage-50' : 'border-sage-200 bg-white hover:border-sage-300'}`}>
                    <input 
                      type="radio" 
                      name="paymentMethod" 
                      value="stripe"
                      checked={paymentMethod === 'stripe'}
                      onChange={() => setPaymentMethod('stripe')}
                      className="accent-sage-600"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-ink">International Card</span>
                      <span className="text-xs text-ink/60">Powered by Stripe</span>
                    </div>
                  </label>
                  <label className={`cursor-pointer flex items-center gap-3 p-4 rounded-xl border ${paymentMethod === 'iyzico' ? 'border-sage-600 bg-sage-50' : 'border-sage-200 bg-white hover:border-sage-300'}`}>
                    <input 
                      type="radio" 
                      name="paymentMethod" 
                      value="iyzico"
                      checked={paymentMethod === 'iyzico'}
                      onChange={() => setPaymentMethod('iyzico')}
                      className="accent-sage-600"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-ink">Türkiye İçi Kredi Kartı</span>
                      <span className="text-xs text-ink/60">Iyzico / PayTR altyapısı</span>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-wide text-ink/50 mb-1.5 block">Email</label>
                <input
                  required
                  type="email"
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-xl border border-sage-200 bg-white focus:outline-none focus:border-sage-500"
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-wide text-ink/50 mb-1.5 block">Cardholder name</label>
                <input
                  required
                  placeholder="Name on card"
                  className="w-full px-4 py-3 rounded-xl border border-sage-200 bg-white focus:outline-none focus:border-sage-500"
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-wide text-ink/50 mb-1.5 block">Card number</label>
                <input
                  required
                  placeholder="1234 5678 9012 3456"
                  className="w-full px-4 py-3 rounded-xl border border-sage-200 bg-cream focus:outline-none focus:border-sage-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase tracking-wide text-ink/50 mb-1.5 block">Expiry</label>
                  <input
                    required
                    placeholder="MM / YY"
                    className="w-full px-4 py-3 rounded-xl border border-sage-200 bg-cream focus:outline-none focus:border-sage-500"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide text-ink/50 mb-1.5 block">CVC</label>
                  <input
                    required
                    placeholder="123"
                    className="w-full px-4 py-3 rounded-xl border border-sage-200 bg-cream focus:outline-none focus:border-sage-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    required
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-1 w-4 h-4 accent-sage-600 rounded"
                  />
                  <span className="text-sm text-ink/70">
                    I have read and agree to the <Link href="/terms" target="_blank" className="text-sage-600 underline font-medium">Mesafeli Satış Sözleşmesi ve Kullanım Koşulları</Link>. I understand the 24-hour cancellation and refund policies.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={paying || !agreedToTerms}
                className="w-full bg-sage-700 hover:bg-sage-800 text-cream py-4 rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {paying ? "Processing..." : `${t.checkout.pay} · ${formatLocalPrice(priceUSD)}`}
              </button>

              <p className="text-xs text-center text-ink/50 flex items-center justify-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                {t.checkout.secure}
              </p>
            </form>
          </div>

          {/* Right: order summary */}
          <div className="lg:col-span-2">
            <div className="bg-cream rounded-3xl border border-sage-100 p-6 lg:p-8 lg:sticky lg:top-24">
              <h3 className="font-display text-xl text-ink mb-6">Summary</h3>

              <div className="space-y-4 mb-6 pb-6 border-b border-sage-100">
                <Row label={t.checkout.teacher} value={teacher.name} />
                <Row
                  label={t.checkout.classType}
                  value={type === 'trial' ? t.checkout.trial : t.profile.regularClass}
                  highlight={type === 'trial'}
                />
                <Row label={t.checkout.date} value={formatLocalDate(slot, locale)} />
                <Row label={t.checkout.time} value={`${formatLocalTime(slot, locale)} (${userTimezone()})`} />
                <Row label={t.checkout.duration} value={`60 ${t.checkout.minutes}`} />
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-ink/60">{t.checkout.yourPrice}</span>
                  <span className="font-display text-2xl text-sage-700">{formatLocalPrice(priceUSD)}</span>
                </div>
                {currency !== 'USD' && (
                  <div className="flex items-baseline justify-between text-xs text-ink/50">
                    <span>{t.checkout.chargedAs}</span>
                    <span>{formatUSD(priceUSD)}</span>
                  </div>
                )}
              </div>

              {type === 'trial' && (
                <div className="mt-6 p-4 rounded-2xl bg-sage-50 border border-sage-200">
                  <p className="text-xs text-sage-800 font-medium mb-1">🌱 {t.profile.fiftyOff}</p>
                  <p className="text-xs text-ink/60">100% goes to your teacher.</p>
                </div>
              )}
            </div>
          </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Row({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className="text-ink/60">{label}</span>
      <span className={highlight ? 'font-medium text-sage-700' : 'font-medium text-ink text-right'}>{value}</span>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <>
      <LanguagePicker />
      <Navbar />
      <Suspense fallback={<div className="min-h-[70vh] flex items-center justify-center">Loading...</div>}>
        <CheckoutInner />
      </Suspense>
      <Footer />
    </>
  );
}
