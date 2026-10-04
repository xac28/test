# 🙏 AYA

> Your practice, anywhere you breathe.

AYA is a 1-on-1 yoga and meditation marketplace — like Cambly/Preply, but for breath, body, and mind.

## ✨ What's in this MVP

- **🌐 Bilingual UI (TR/EN)** — Language picker on first visit, toggle in navbar
- **🏠 Landing page** — Hero, "How it works", and CTA sections
- **🔍 Teacher discovery** — Browse all teachers, filter by yoga style, level, and experience
- **👤 Teacher profile** — Bio, video intro placeholder, certifications, schedule
- **📅 Booking widget** — Pick day → pick time slot → proceed to checkout
- **💳 Checkout flow** — Trial vs regular class, prices in user's local currency (charged in USD), mock payment form with success state
- **🌍 Timezone-aware** — All times shown in user's local timezone (UTC stored under the hood)
- **🎨 Custom design** — Sage green & clay tones, Cormorant Garamond display font, subtle textures

## 🚀 Getting started

You'll need [Node.js](https://nodejs.org/) installed (version 18 or newer).

```bash
# 1. Install dependencies
npm install

# 2. Run the development server
npm run dev

# 3. Open in browser
# → http://localhost:3000
```

## 📁 Project structure

```
aya/
├── src/
│   ├── app/                       # Next.js App Router pages
│   │   ├── page.tsx               # Landing page
│   │   ├── layout.tsx             # Root layout
│   │   ├── globals.css            # Global styles
│   │   ├── teachers/
│   │   │   ├── page.tsx           # Teacher listing + filters
│   │   │   └── [slug]/page.tsx    # Individual teacher profile
│   │   └── checkout/page.tsx      # Booking checkout
│   ├── components/                # Reusable UI components
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   ├── LanguagePicker.tsx     # First-visit language modal
│   │   ├── TeacherCard.tsx
│   │   └── BookingWidget.tsx      # Calendar + slot picker
│   ├── i18n/                      # Internationalization
│   │   ├── index.tsx              # Provider + useI18n hook
│   │   ├── en.ts                  # English strings
│   │   └── tr.ts                  # Turkish strings
│   └── lib/                       # Helpers + mock data
│       ├── teachers.ts            # Mock teacher data
│       ├── constants.ts           # Yoga styles, levels
│       ├── currency.ts            # USD ↔ local conversion
│       └── time.ts                # Timezone helpers
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── next.config.js
```

## 🛣️ Roadmap (next steps)

This is just the visual + flow MVP. To go to production we'll add:

- [ ] **Auth** — NextAuth.js (Google, Apple, email)
- [ ] **Database** — PostgreSQL + Prisma (real users, teachers, bookings)
- [ ] **Payments** — Stripe Connect for international, Iyzico for Turkey
- [ ] **Live video** — Daily.co or LiveKit for the actual classes
- [ ] **Teacher onboarding** — Application form + admin approval flow
- [ ] **Teacher dashboard** — Manage availability, bookings, payouts
- [ ] **Student dashboard** — Upcoming classes, history, favorites
- [ ] **Reviews** — Post-class rating system
- [ ] **Notifications** — Email reminders (Resend/Postmark)
- [ ] **Mobile app** — Expo/React Native, sharing the same backend

## 🎨 Design notes

- **Palette:** Sage greens (`#516e42` to `#aec39d`) + warm clay accents (`#b6764c`) + cream background (`#faf6f0`)
- **Display font:** Cormorant Garamond (italic for elegance, used in headlines)
- **Body font:** Inter
- **Avoid:** generic SaaS purple gradients, AI-aesthetic minimalism. We want warmth, breath, calm.

## 🧘 Vision

> Connect students and teachers anywhere on Earth for live yoga & meditation classes —
> like Cambly and Preply, but exclusively for the practice of breath, body, and stillness.
