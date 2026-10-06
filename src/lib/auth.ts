// NextAuth.js v5 (Auth.js) — CourtControlAI
// Google OAuth provider, JWT session (database adapter sonra eklenebilir)
// Hibrit pattern: Firebase Auth paralel, identity unification email match ile

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Scope: email + profile (default)
      authorization: {
        params: {
          prompt: "select_account", // hesap seçtirme zorunluluğu
        },
      },
    }),
  ],

  pages: {
    signIn: "/login",
    error: "/login",
  },

  // JWT session (default — database adapter eklenene kadar)
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 gün
  },

  callbacks: {
    // JWT'ye user bilgisi ekle
    async jwt({ token, user, account }) {
      if (user) {
        token.userId = user.id;
        token.email = user.email;
      }
      if (account) {
        token.provider = account.provider;
      }
      return token;
    },

    // Session'a user ID ekle
    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },

    // Authorized middleware için
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = request.nextUrl.pathname.startsWith("/login");
      const isOnApiAuth = request.nextUrl.pathname.startsWith("/api/auth");
      const isOnPublic =
        request.nextUrl.pathname === "/" ||
        request.nextUrl.pathname.startsWith("/arena") ||
        request.nextUrl.pathname.startsWith("/leaderboard") ||
        request.nextUrl.pathname.startsWith("/results");

      if (isOnApiAuth) return true;
      if (isOnPublic) return true;
      if (isOnLogin) return true;
      return isLoggedIn;
    },
  },

  trustHost: true, // Vercel preview deployment'lar için
});

/**
 * TypeScript module augmentation — session.user'a id eklemek için
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }
}