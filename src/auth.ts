import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { db } from "@/lib/db"
import authConfig from "./auth.config"
import bcrypt from "bcryptjs"
import Credentials from "next-auth/providers/credentials"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { 
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days max (actual lifetime controlled in jwt callback)
  },
  ...authConfig,
  pages: {
    signIn: "/login",
    error: "/auth-error",
  },
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        rememberMe: { label: "Remember Me", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = (credentials.email as string).toLowerCase();
        
        const user = await db.user.findUnique({
          where: { email }
        });

        if (!user || !user.password) return null;

        // 🛡️ Banned user kontrolü — login'de engelle
        if (user.banned) {
          console.log(`[AUTH] 🚨 Banned user login attempt: ${email}`)
          return null; // NextAuth "Invalid credentials" döner
        }

        const passwordsMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (passwordsMatch) {
          // Pass rememberMe flag through user object to jwt callback
          return { ...user, rememberMe: credentials.rememberMe === "true" };
        }
        
        return null;
      }
    })
  ],
  events: {
    // 🛡️ Başarılı login/signup sonrası IP loglama (Google OAuth dahil)
    async signIn({ user, account }) {
      if (user?.id) {
        try {
          // IP loglama için bir marker set et — 
          // middleware'de yakalanacak çünkü NextAuth events'te req yok
          console.log(`[AUTH] User signed in: ${user.email} via ${account?.provider || "credentials"}`)
        } catch {}
      }
    },
  },
  callbacks: {
    // 🛡️ Google OAuth sign-in'de ban kontrolü
    async signIn({ user, account }) {
      if (user?.email) {
        const existingUser = await db.user.findUnique({
          where: { email: user.email.toLowerCase() },
          select: { banned: true, banReason: true }
        })

        if (existingUser?.banned) {
          console.log(`[AUTH] 🚨 Banned user OAuth attempt: ${user.email} via ${account?.provider}`)
          return false // Girişi engelle
        }
      }
      return true
    },
    async session({ token, session }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      if (token.role && session.user) {
        session.user.role = token.role as any;
      }
      return session;
    },
    async jwt({ token, user }) {
      // On initial sign-in, user object is available
      if (user) {
        token.rememberMe = (user as any).rememberMe ?? false;
        token.loginAt = Date.now();
      }

      if (!token.sub) return token;
      
      // If NOT "Remember Me", expire after browser session (check if > 1 day since login)
      if (!token.rememberMe && token.loginAt) {
        const elapsed = Date.now() - (token.loginAt as number);
        if (elapsed > 24 * 60 * 60 * 1000) {
          return {} as any; // Forces re-login
        }
      }

      const existingUser = await db.user.findUnique({
        where: { id: token.sub }
      });
      
      if (!existingUser) return token;

      // 🛡️ Banned kullanıcıları engelle — oturumu geçersiz kıl
      if (existingUser.banned) {
        console.log(`[AUTH] 🚨 Banned user session invalidated: ${existingUser.email}`)
        return {} as any; // Token'ı boşalt — forces re-login, login de çalışmaz
      }

      // Ensure Admin Promotion even for existing users
      const adminEmail = process.env.ADMIN_EMAIL
      if (adminEmail && existingUser.email === adminEmail && existingUser.role !== "ADMIN") {
        await db.user.update({
          where: { id: existingUser.id },
          data: { role: "ADMIN" }
        })
        existingUser.role = "ADMIN"
        console.log(`[AUTO-ADMIN] Promoted existing user ${existingUser.email} to ADMIN`)
      }
      
      token.role = existingUser.role;
      return token;
    }
  },
  // FIX #10: Production'da secure cookies aktif, development'ta kapalı
  useSecureCookies: process.env.NODE_ENV === "production",
})
