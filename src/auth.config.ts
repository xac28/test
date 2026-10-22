import Google from "next-auth/providers/google"
import type { NextAuthConfig } from "next-auth"

/**
 * Edge-safe config (no Prisma). The middleware builds its own NextAuth instance from
 * this file, so the `session` callback lives here: it copies the claims that the
 * Node-side `jwt` callback (auth.ts) stored in the token — role and termsAccepted —
 * onto `req.auth.user`, which is what the role checks and the terms gate read.
 */
export default {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    })
  ],
  callbacks: {
    async session({ token, session }) {
      if (token.sub && session.user) {
        session.user.id = token.sub
      }
      if (token.role && session.user) {
        session.user.role = token.role as any
      }
      if (session.user) {
        // `undefined` (old tokens) is treated as "unknown" by the middleware; only `false` is gated.
        session.user.termsAccepted = token.termsAccepted as boolean
      }
      return session
    },
  },
  trustHost: true,
} satisfies NextAuthConfig
