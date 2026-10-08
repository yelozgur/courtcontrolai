// NextAuth.js v5 (Auth.js) — CourtControlAI
// Google OAuth provider + PrismaAdapter (Neon Postgres)
// Hibrit pattern: Firebase Auth paralel, identity unification email match ile

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import { getFirebaseAdmin } from "./firebase-admin";
import { timingSafeEqual } from "node:crypto";

const TEST_USER_EMAIL = process.env.AUTH_TEST_USER_EMAIL || "test@courtcontrolai.local";
const TEST_USER_ID = "test-user-e2e";

function testSessionProvider() {
  return Credentials({
    id: "test-session",
    name: "Test Session",
    credentials: {
      token: { label: "Token", type: "text" },
    },
    async authorize(credentials) {
      const expectedToken = process.env.AUTH_TEST_TOKEN;
      if (!expectedToken) return null;

      const providedToken = credentials?.token;
      if (typeof providedToken !== "string" || !providedToken) return null;

      const expectedBuf = Buffer.from(expectedToken);
      const providedBuf = Buffer.from(providedToken);

      if (expectedBuf.length !== providedBuf.length) return null;

      if (!timingSafeEqual(expectedBuf, providedBuf)) return null;

      return {
        id: TEST_USER_ID,
        email: TEST_USER_EMAIL,
        name: "E2E Test User",
        emailVerified: new Date(),
      };
    },
  });
}

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
    ...(process.env.AUTH_TEST_ENABLED === "true" ? [testSessionProvider()] : []),
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
        // Firebase bridge is best-effort. Vercel doesn't carry FIREBASE_ADMIN_*,
        // so the bridge must degrade to a no-op rather than blocking sign-in.
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
          console.warn(
            '[auth] Firebase bridge unavailable, sign-in continues without Firebase UID sync:',
            error instanceof Error ? error.message : error
          );
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
      if (token.email && token.provider === "google") {
        // Same graceful-degradation contract as signIn: missing FIREBASE_ADMIN_*
        // must not poison every Google session.
        try {
          const adminAuth = getFirebaseAdmin();
          const firebaseUser = await adminAuth.getUserByEmail(token.email as string);
          token.firebaseUid = firebaseUser.uid;
        } catch (error) {
          if (!token.firebaseUid) {
            console.warn(
              '[auth] Firebase UID sync skipped (admin SDK unavailable):',
              error instanceof Error ? error.message : error
            );
          }
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