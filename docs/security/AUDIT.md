# Security Audit — CourtControlAI

**Auditor:** security-team agent  
**Date:** 2026-10-08  
**Branch:** `fix/sel57-test-auth-provider`  
**Commit:** `0a8144e` (error-leak fix) + this audit's fixes

---

## Attack Surface Summary

| Category | Routes | Auth | Notes |
|----------|--------|------|-------|
| Public (no auth) | `/api/health`, `/api/ai/status`, `/api/clubs` GET, `/api/tournaments` GET, `/api/fixtures` GET, `/api/teams` GET, `/api/results` GET | None | Intentionally public — tournament data is spectator-facing |
| Auth required | `/api/venues`, `/api/venues/[id]`, `/api/clubs` POST, `/api/tournaments` POST, `/api/teams` POST, `/api/results` POST, `/api/fixtures` POST, `/api/checkin` POST, `/api/scheduler/solve` POST, `/api/firebase-bridge-token`, `/api/standings` GET, `/api/telegram/test` | `auth()` + club ownership | Write operations scoped to club admin; standings scoped to tournament's club |
| Dev-only | `/api/firestore/[...path]` | None (dev only) | Disabled in production, allowlisted collections only |
| External proxy | `/api/telegram/send` | None | Token redaction in place; no auth — see Finding 5 |

---

## Finding 9 — Google sign-in redirect loop (CRITICAL) — SEL-96

**Status:** Fixed.

**Precondition:** User signs in via Google OAuth in production (where `FIREBASE_ADMIN_*` env vars are not set).

**Reproduction:** Code-reviewed, not executed (requires a live Google OAuth flow against production). The attack surface is the redirect loop itself — no data exposure, but complete denial of authenticated access.

**Root cause:** `src/app/dashboard/layout.tsx` gated dashboard access on the Firebase client-side auth state (`useUser()` from `src/firebase/auth/use-user.tsx`). After a successful NextAuth/Google sign-in:

1. NextAuth creates a session in Neon/Prisma (confirmed by `schema_courtcontrolai.Account` and `schema_courtcontrolai.User` rows).
2. The `jwt` callback in `src/lib/auth.ts` attempts to sync the Firebase UID via `getFirebaseAdmin()`, but `FIREBASE_ADMIN_CLIENT_EMAIL` and `FIREBASE_ADMIN_PRIVATE_KEY` are not set in Vercel production → the bridge degrades gracefully with a `console.warn`.
3. `token.firebaseUid` is never set → `session.user.firebaseUid` is null.
4. The login page's bridge attempt (`/api/firebase-bridge-token`) returns 400 because `firebaseUid` is missing → `signInWithCustomToken` never fires → Firebase client auth has no user.
5. `useUser()` returns `user: null` → the layout's `useEffect` calls `router.replace('/login')` → permanent redirect loop.

**Impact:** Complete denial of service for all Google sign-in users. The dashboard is unreachable after authentication. This is the most demo-blocking defect in the project.

**Architecture decision:** Gate on NextAuth session instead of Firebase Auth.

**Rationale:**
- Phase 1 already moved the authoritative data layer to Prisma/Neon. All API routes use `auth()` from NextAuth.
- `FIREBASE_ADMIN_*` is not set in production and enabling it is a separate approved step.
- The Firebase client SDK is still used for Firestore reads (profile, club data), but its absence should not block dashboard access — the UI renders with fallback values.
- Two identity systems where one is never established in production is untenable. The authoritative system (NextAuth/Prisma) must be the gate.

**What changed:**
- `src/app/dashboard/layout.tsx`:
  - Redirect guard now checks `sessionStatus === 'authenticated' && session?.user` (NextAuth) instead of `!authLoading && !user` (Firebase).
  - Removed the `authUnavailable` error screen — Firebase being unavailable no longer blocks dashboard access.
  - Sign-out now calls both `firebaseSignOut(auth)` (best-effort) and `nextAuthSignOut()` (authoritative).
  - Removed unused imports: `ServerCrash`, `Gavel`, `ChevronLeft`.

**What stays:**
- Firebase client SDK for Firestore reads (clubs, tournaments, profiles).
- The Firebase bridge code in `auth.ts` (best-effort, degrades gracefully).
- The login page's bridge attempt (will fail without `FIREBASE_ADMIN_*`, but that's acceptable).

**What becomes unnecessary after this fix:**
- The `authUnavailable` error screen in the dashboard layout.
- The dependency on Firebase Auth for dashboard access.

**What still requires `FIREBASE_ADMIN_*` in production:**
- Firestore reads in the dashboard (profile data, club data via `useUserClub`).
- The Firebase bridge token endpoint (`/api/firebase-bridge-token`).
- Without these env vars, the dashboard renders with fallback values (no profile photo, no admin role detection, no club data from Firestore).

**Regression test:** `src/app/dashboard/__tests__/layout-auth.test.tsx` — 6 tests verifying:
1. OLD logic redirects when NextAuth session is valid but Firebase user is null (THE BUG).
2. NEW logic does NOT redirect in that case (THE FIX).
3. NEW logic still redirects when NextAuth session is unauthenticated.
4. NEW logic does NOT redirect while NextAuth session is loading.
5. NEW logic does NOT redirect when Firebase is unavailable but NextAuth session is valid.
6. NEW logic does NOT redirect when both NextAuth and Firebase are valid.

---

## Auth-state consumer audit (SEL-96 requirement)

Every site that reads auth state, with whether it agrees with the decision to gate on NextAuth:

| File | Hook/Function | Auth Source | Agrees with decision? | Notes |
|------|--------------|-------------|----------------------|-------|
| `src/app/dashboard/layout.tsx` | `useSession()` | NextAuth | **Yes** | Redirect guard — FIXED in this commit |
| `src/app/dashboard/layout.tsx` | `useUser()` | Firebase | **Yes** | Firestore profile read only; null is handled by fallback rendering |
| `src/app/login/page.tsx` | `useSession()` | NextAuth | **Yes** | Triggers Firebase bridge after NextAuth sign-in |
| `src/app/login/page.tsx` | `useUser()` | Firebase | **Yes** | Loading state for login page; does not gate access |
| `src/app/login/page.tsx` | `useAuth()` | Firebase | **Yes** | Firebase email/password sign-in; needs Firebase auth |
| `src/app/signup/page.tsx` | `useUser()` | Firebase | **Yes** | Loading state; does not gate access |
| `src/app/signup/page.tsx` | `useAuth()` | Firebase | **Yes** | Firebase sign-up; needs Firebase auth |
| `src/app/page.tsx` | `useUser()` | Firebase | **Yes** | Public page; controls UI (show/hide dashboard link) |
| `src/app/dashboard/page.tsx` | `useUser()` | Firebase | **Yes** | Child of layout; Firestore data queries |
| `src/app/dashboard/tournaments/page.tsx` | `useUser()` | Firebase | **Yes** | Child of layout; Firestore data queries |
| `src/app/dashboard/schedule/page.tsx` | `useUser()` | Firebase | **Yes** | Child of layout; Firestore data queries |
| `src/app/dashboard/participants/page.tsx` | `useUser()` | Firebase | **Yes** | Child of layout; Firestore data queries |
| `src/app/dashboard/club/page.tsx` | `useUser()` | Firebase | **Yes** | Child of layout; Firestore data queries |
| `src/app/dashboard/profile/page.tsx` | `useUser()` | Firebase | **Yes** | Child of layout; Firestore data queries |
| `src/app/dashboard/sponsors/page.tsx` | `useUser()` | Firebase | **Yes** | Child of layout; Firestore data queries |
| `src/app/dashboard/check-in/page.tsx` | `useUser()` | Firebase | **Yes** | Child of layout; Firestore data queries |
| `src/app/dashboard/tournaments/new/page.tsx` | `useUser()` | Firebase | **Yes** | Child of layout; Firestore data queries |
| `src/app/dashboard/admin/costs/page.tsx` | `useUser()` | Firebase | **Yes** | Child of layout; Firestore data queries |
| `src/app/dashboard/admin/users/page.tsx` | `useUser()` | Firebase | **Yes** | Child of layout; Firestore data queries |
| `src/app/tournaments/new/page.tsx` | `useUser()` | Firebase | **Yes** | Public route; Firestore data queries |
| `src/app/tournaments/[id]/register/page.tsx` | `useUser()` | Firebase | **Yes** | Public route; Firestore data queries |
| `src/firebase/use-user-club.ts` | `useUser()` | Firebase | **Yes** | Returns null when no user; no cross-tenant leak |
| All API routes (`src/app/api/**`) | `auth()` | NextAuth | **Yes** | Server-side; all use `session.user.id` for authorization |

**Conclusion:** All auth-state consumers agree with the decision. The dashboard layout is the only site that was gating access on Firebase Auth; all other sites either use NextAuth correctly (API routes, login page bridge) or use Firebase Auth for data reads without gating access (child pages of dashboard, public pages).

---

## Finding 1 — Identity mismatch breaks authorisation (CRITICAL)

**Status:** Fixed in this commit.

**Precondition:** `FIREBASE_ADMIN_*` env vars are set (currently not set in Vercel production).

**Root cause:** `src/lib/auth.ts` issues two user identifiers:
- `session.user.id` — Prisma `User.id` (cuid), the canonical DB identifier
- `session.user.firebaseUid` — Firebase UID, set only when Firebase Admin bridge succeeds

`Club.ownerId` stores Prisma `User.id`. Every authorisation check used `session.user.firebaseUid || session.user.id`. When Firebase bridge succeeds, `firebaseUid` wins, comparing a Firebase UID against a Prisma cuid → always false → 403 for the rightful owner.

**Impact:** Enabling `FIREBASE_ADMIN_*` would silently lock every club owner out of their own venue management. The bug was masked by the missing env var.

**Fix:** All API routes now use `session.user.id` exclusively for database authorisation. `login/page.tsx` uses `session.user.firebaseUid` only for Firestore document keys (correct — Firestore `users` collection is keyed by Firebase UID).

**Files changed:**
- `src/app/api/clubs/route.ts` — `ownerId` and `adminIds` now use `session.user.id`
- `src/app/api/venues/route.ts` — club lookup uses `session.user.id`
- `src/app/api/venues/[id]/route.ts` — `canManageClub` uses `session.user.id` (3 methods)
- `src/app/api/tournaments/route.ts` — simplified to single-ID check
- `src/app/api/teams/route.ts` — simplified to single-ID check
- `src/app/api/results/route.ts` — simplified to single-ID check
- `src/app/login/page.tsx` — Firestore doc key uses `firebaseUid` only, skips if unavailable

**Migration note:** Existing `Club.ownerId` values are Prisma `User.id` (cuid). No data migration needed — the fix aligns the check with the stored value.

**Is enabling `FIREBASE_ADMIN_*` safe now?** Yes. The authorisation checks no longer depend on `firebaseUid`. The Firebase bridge is purely for client-side Firebase Auth (Firestore, custom tokens).

---

## Finding 2 — Unauthenticated GET handlers expose tenant data (CRITICAL)

**Status:** Fixed in this commit. Three endpoints now require auth; three remain public by design.

**Precondition:** None — anonymous HTTP requests.

**Root cause:** Six GET endpoints had no `auth()` check. The middleware allows `/`, `/arena`, `/tournaments` as public pages, but the API routes were not aligned with this design.

**Impact:**
- `/api/teams` exposed `playerIds` (internal user identifiers) for all teams across all tournaments
- `/api/fixtures` exposed `player1Id`, `player2Id`, `scheduledAt` for all matches
- `/api/results` exposed `player1Id`, `player2Id`, scores, `playedAt` for all completed matches
- `/api/clubs` exposed club directory (name, slug, logo) — no sensitive data
- `/api/tournaments` exposed tournament listing — no sensitive data
- `/api/standings` exposed aggregate statistics — no personal data

**Fix:**
- **Added auth to:** `/api/teams`, `/api/fixtures`, `/api/results` — these expose player identifiers
- **Kept public:** `/api/clubs`, `/api/tournaments`, `/api/standings` — directory and spectator data only
- **Added pagination:** All six endpoints now have `take` limits (50-200) to prevent unbounded queries

### Public vs. Private — Explicit Decisions

| Endpoint | Auth Required? | Reasoning |
|----------|----------------|-----------|
| `/api/clubs` | **No** | Club directory (name, slug, logo) — no sensitive data. Public by design for discovery. |
| `/api/tournaments` | **No** | Tournament listing (name, dates, club name) — no sensitive data. Public by design for discovery. |
| `/api/standings` | **Yes** (SEL-81) | Exposes `playerIds` via `tournament.teams` and tournament-scoped match data. Scoped to club owner/admin. |
| `/api/teams` | **Yes** | Exposes `playerIds` (internal user identifiers). Multi-tenant leak if unauthenticated. |
| `/api/fixtures` | **Yes** | Exposes `player1Id`, `player2Id`, `scheduledAt`. Player identifiers + scheduling data. |
| `/api/results` | **Yes** | Exposes `player1Id`, `player2Id`, scores, `playedAt`. Player identifiers + match history. |

### Cross-Tenant Leakage

**Before fix:** Any anonymous user could enumerate all teams and their `playerIds` across all tournaments. This is a multi-tenant data leak — Club A's member identifiers exposed to Club B's competitors.

**After fix:** Only authenticated users can access team/fixture/result data. The `playerIds` are still exposed to authenticated users, but this is acceptable because:
1. Authentication establishes a relationship (user is a club admin or participant)
2. Tournament participants expect their match history to be visible to other participants
3. The product is a tournament management system — match data is shared among participants

**Remaining risk:** An authenticated user of Club A can still see Club B's team data if they know the `tournamentId`. This is a product design question: should tournaments be isolated to a single club, or are multi-club tournaments a feature? The current schema allows multi-club tournaments (Team has `clubId`, but Match has `player1Id`/`player2Id` without club scoping). **This requires a product decision** — see Recommendations below.

### Rate Limiting and Pagination

**Before fix:** All endpoints returned unlimited results. An attacker could:
1. Enumerate all data by making repeated requests
2. Cause database load spikes with unbounded queries
3. Exfiltrate the entire dataset with a simple script

**After fix:** All endpoints have `take` limits:
- `/api/clubs`: 50 clubs
- `/api/tournaments`: 100 tournaments
- `/api/teams`: 100 teams
- `/api/fixtures`: 200 matches
- `/api/results`: 200 matches
- `/api/standings`: No limit (aggregate data, bounded by tournament size)

**Remaining risk:** No rate limiting per IP/user. An attacker can still make many requests over time. **Recommendation:** Add Vercel Edge rate limiting or a middleware rate limiter. See Recommendations below.

---

## Finding 3 — Error-leak fix verification (VERIFIED + additional leaks fixed)

**Status:** Original fix in `0a8144e` verified. Additional leaks found and fixed.

**Original fix:** 15 catch blocks had `details: (error as Error).message` removed. Verified: no remaining `details.*error.*message` patterns in API routes.

**Additional leaks found and fixed:**
- `src/app/api/fixtures/route.ts` — forwarded scheduler error text as `details`
- `src/app/api/scheduler/solve/route.ts` — leaked `scheduler_url` (internal infrastructure) and `detail` (error message) to client
- `src/app/api/telegram/test/route.ts` — leaked `e.message` in catch block

**Verification method:** Code review of all catch blocks. The original fix correctly moved error messages to `console.error` only. The additional leaks were in routes that forwarded upstream error text (scheduler, Telegram) rather than Prisma errors.

---

## Finding 4 — IDOR in `/api/checkin` and `/api/fixtures` POST (HIGH)

**Status:** Fixed in this commit.

**Precondition:** Any authenticated user (not necessarily a club admin).

**Root cause:** Both routes checked `session?.user` (authenticated) but did not verify the user has permission to manage the tournament's club.

**Impact:**
- `/api/checkin` — any authenticated user could create check-in records for any registration in any tournament
- `/api/fixtures` POST — any authenticated user could generate/delete fixtures for any tournament

**Fix:** Both routes now traverse registration/tournament → club and verify `ownerId` or `adminIds` membership.

---

## Finding 5 — Telegram routes have no authentication (LOW)

**Status:** Partially fixed. `/api/telegram/test` now requires `auth()`. `/api/telegram/send` remains open (requires product decision on club-level token override model).

**Routes:** `/api/telegram/send`, `/api/telegram/test`

**Fix (SEL-81):** `/api/telegram/test` POST and GET now require `auth()`. The body-supplied `botToken` field is no longer honoured — only the server-side `TELEGRAM_BOT_TOKEN` env var is used. This prevents unauthenticated callers from making the server issue Telegram API calls with arbitrary tokens.

**Remaining:** `/api/telegram/send` still accepts a `botToken` from the request body (club-level override). Token redaction is in place. Requires product decision on whether club-level token override is a feature.

---

## Finding 6 — `openHours` accepts arbitrary JSON objects (LOW)

**Status:** Noted, not fixed (low risk).

**Analysis:** `PATCH /api/venues/[id]` validates `openHours` is a non-array object, but accepts any object shape. The solver reads it as `Record<string, string[][]>`. A deeply nested object would be stored in Postgres `Json?` but fail when the solver processes it.

**Risk:** Storage of malformed data. No code execution risk — Prisma serialises JSON safely. No size limit on request body, but Vercel's serverless limit (4.5 MB default) applies.

**Recommendation:** Add JSON Schema validation for `openHours` structure when the feature is actively used.

---

## Finding 7 — Payment fields are not exploitable (SAFE)

**Status:** Verified safe.

**Analysis:** `Registration.paymentStatus` defaults to `waived`, `paidAmount` defaults to 0. No API route writes to these fields. There is no registration API route at all — registrations are created through a different mechanism (not in this codebase).

**Conclusion:** No route lets a caller mark themselves paid. Safe by absence of attack surface.

---

## Tenant Isolation

**Club-scoped queries:** All write routes (`venues`, `tournaments`, `teams`, `results`, `fixtures`, `checkin`, `scheduler/solve`) now verify club ownership via `ownerId` or `adminIds`.

**Cross-club reads:** `GET /api/clubs`, `GET /api/tournaments`, `GET /api/teams`, `GET /api/fixtures`, `GET /api/results` return data across all clubs. This is intentional — tournament data is public.

**Venue isolation:** `GET /api/venues` and `GET /api/venues/[id]` are scoped to the authenticated user's club. No cross-club leakage.

---

## Unauthenticated Endpoints (Intentional)

| Endpoint | Reason |
|----------|--------|
| `/api/health` | Uptime probe — returns status, version, latency only |
| `/api/ai/status` | Feature flag probe — returns enabled/disabled only |
| `/api/standings` GET | ~~Public~~ — now requires auth (SEL-81). Exposes `playerIds` via team data. |
| `/api/clubs` GET | Public directory — club name/slug/logo only, no ownerId |
| `/api/tournaments` GET | Public tournament listing — name/dates/club only |

## Authenticated Endpoints (Fixed in this commit)

| Endpoint | Data Exposed | Why Auth Required |
|----------|--------------|-------------------|
| `/api/teams` GET | `playerIds` (user identifiers) | Multi-tenant leak — exposes member IDs across clubs |
| `/api/fixtures` GET | `player1Id`, `player2Id`, `scheduledAt` | Player identifiers + scheduling data |
| `/api/results` GET | `player1Id`, `player2Id`, scores, `playedAt` | Player identifiers + match history |
| `/api/standings` GET | `teamId`, `clubId`, `playerIds` (via teams), scores | Tournament data scoped to club owner/admin (SEL-81) |
| `/api/telegram/test` POST | Bot metadata, optional message send result | Server-side Telegram proxy — auth prevents abuse (SEL-81) |

---

## Finding 8 — Client-exposed auth bypass via `NEXT_PUBLIC_AUTH_TEST_ENABLED` (HIGH)

**Status:** Fixed in SEL-81.

**Precondition:** `NEXT_PUBLIC_AUTH_TEST_ENABLED=true` set in environment (was present in `.env.local`).

**Root cause:** `src/app/dashboard/layout.tsx` (a `'use client'` component) read `process.env.NEXT_PUBLIC_AUTH_TEST_ENABLED` and, when true together with a NextAuth session, skipped the Firebase auth gate and the `/login` redirect. Two problems:

1. `NEXT_PUBLIC_` values are inlined into the client bundle at build time. If this flag were ever set in Vercel production, it would change shipped client behaviour — the bypass would be compiled into the JS sent to every user's browser.
2. The flag was set to `true` in `.env.local` with nothing preventing that file from being used as a template.

**Impact:** If armed in production, any user with a NextAuth session (including a stale or revoked one) could bypass Firebase auth entirely and access the dashboard without valid Firebase credentials.

**Fix:**
- Created `src/app/api/auth/test-mode/route.ts` — a server-only endpoint that returns `{ enabled: boolean }`. It hard-refuses to return `true` when `NODE_ENV === 'production'`, regardless of any env var.
- `layout.tsx` now fetches `/api/auth/test-mode` on mount instead of reading a `NEXT_PUBLIC_` env var.
- Removed `NEXT_PUBLIC_AUTH_TEST_ENABLED` from `.env.local`.
- The existing server-only `AUTH_TEST_ENABLED` (no `NEXT_PUBLIC_` prefix) is reused — it already gates the test-session provider in `auth.ts`.

**Naming rationale:** No new variable was created. The existing `AUTH_TEST_ENABLED` is already server-only. The new `/api/auth/test-mode` endpoint adds the `NODE_ENV !== 'production'` hard guard that the client component cannot bypass.

---

## Recommendations

1. **Add auth to Telegram routes** — restrict to club admins or add rate limiting
2. **Add JSON Schema validation for `openHours`** — prevent malformed data storage
3. **Add request body size limits** — explicit `Content-Length` check before parsing
4. **Document the public API contract** — make it clear which endpoints are intentionally unauthenticated
5. **Enable `FIREBASE_ADMIN_*` in Vercel** — now safe after Finding 1 fix
6. **Add rate limiting** — Vercel Edge middleware or per-IP rate limiter to prevent enumeration attacks on public endpoints
7. **Decide multi-club tournament isolation** — currently an authenticated user of Club A can see Club B's team/player data if they know the `tournamentId`. Either:
   - Restrict tournaments to single-club (add club scope to queries), or
   - Accept that multi-club tournaments expose participant data to all participating clubs (document this as a product decision)
8. **Add pagination cursors** — current `take` limits prevent unbounded queries but don't support pagination. Add `cursor`/`skip` parameters for legitimate large datasets.

---

## Verification

- `npx tsc --noEmit` — passes with no errors
- All catch blocks reviewed — no remaining `details: error.message` patterns
- All authorisation checks use `session.user.id` consistently
- IDOR fixes verified by code review (traversal to club ownership)
