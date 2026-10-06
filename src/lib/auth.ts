// NextAuth.js v5 (Auth.js) — CourtControlAI
// Google OAuth provider + PrismaAdapter (Neon Postgres)
// Hibrit pattern: Firebase Auth paralel, identity unification email match ile

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import { getFirebaseAdmin } from "./firebase-admin";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
  ],

  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google' && user.email) {
        try {
          const adminAuth = getFirebaseAdmin();
          try {
            await adminAuth.getUserByEmail(user.email);
          } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
              await adminAuth.createUser({
                email: user.email,
                emailVerified: true,
                displayName: user.name || undefined,
                photoURL: user.image || undefined,
              });
            } else {
              throw error;
            }
          }
        } catch (error) {
          console.error('Firebase bridge failed:', error);
          return false;
        }
      }
      return true;
    },

    async jwt({ token, user, account }) {
      if (user) {
        token.userId = user.id;
        token.email = user.email;
      }
      if (account) {
        token.provider = account.provider;
      }
      if (token.email) {
        try {
          const adminAuth = getFirebaseAdmin();
          const firebaseUser = await adminAuth.getUserByEmail(token.email as string);
          token.firebaseUid = firebaseUser.uid;
        } catch (error) {
          console.error('Failed to get Firebase UID for JWT:', error);
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId as string;
      }
      if (session.user && token.firebaseUid) {
        session.user.firebaseUid = token.firebaseUid as string;
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

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      firebaseUid?: string | null;
    };
  }
}