# Security Audit — CourtControlAI

**Auditor:** security-team agent  
**Date:** 2026-10-08  
**Branch:** `fix/sel57-test-auth-provider`  
**Commit:** `0a8144e` (error-leak fix) + this audit's fixes

---

## Attack Surface Summary

| Category | Routes | Auth | Notes |
|----------|--------|------|-------|
| Public (no auth) | `/api/health`, `/api/ai/status`, `/api/standings`, `/api/clubs` GET, `/api/tournaments` GET, `/api/fixtures` GET, `/api/teams` GET, `/api/results` GET | None | Intentionally public — tournament data is spectator-facing |
| Auth required | `/api/venues`, `/api/venues/[id]`, `/api/clubs` POST, `/api/tournaments` POST, `/api/teams` POST, `/api/results` POST, `/api/fixtures` POST, `/api/checkin` POST, `/api/scheduler/solve` POST, `/api/firebase-bridge-token` | `auth()` + club ownership | Write operations scoped to club admin |
| Dev-only | `/api/firestore/[...path]` | None (dev only) | Disabled in production, allowlisted collections only |
| External proxy | `/api/telegram/send`, `/api/telegram/test` | None | Token redaction in place; no auth — see Finding 5 |

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

## Finding 2 — `/api/standings` has no authentication (DECIDED: intentionally public)

**Status:** No fix needed. Documented as intentional.

**Analysis:** The middleware in `src/lib/auth.ts` explicitly allows `/leaderboard` as a public path. Standings data (tournament name, team names, win/loss records) is inherently spectator-facing. No personal data (emails, phone numbers) is exposed — only internal `playerIds` and aggregate statistics.

**Decision:** This is a public leaderboard API. The lack of authentication is intentional, matching the public `/leaderboard` page route.

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

**Status:** Noted, not fixed (requires product decision).

**Routes:** `/api/telegram/send`, `/api/telegram/test`

**Analysis:** These routes accept a `botToken` in the request body or fall back to `TELEGRAM_BOT_TOKEN` env var. The `send` route redacts tokens from error responses. The `test` route validates tokens against Telegram API.

**Risk:** An attacker could use the server as a proxy to send Telegram messages via arbitrary bot tokens, or probe whether a token is valid. The server's `TELEGRAM_BOT_TOKEN` is never exposed (redacted in errors), but the endpoint could be abused for sending spam.

**Recommendation:** Add `auth()` check to both routes, restricting to club admins. Alternatively, rate-limit the endpoint.

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
| `/api/standings` | Public leaderboard — tournament results are spectator data |
| `/api/clubs` GET | Public directory — no sensitive fields (no ownerId exposed) |
| `/api/tournaments` GET | Public tournament listing |
| `/api/fixtures` GET | Public match schedule |
| `/api/teams` GET | Public team listing |
| `/api/results` GET | Public match results |

---

## Recommendations

1. **Add auth to Telegram routes** — restrict to club admins or add rate limiting
2. **Add JSON Schema validation for `openHours`** — prevent malformed data storage
3. **Add request body size limits** — explicit `Content-Length` check before parsing
4. **Document the public API contract** — make it clear which endpoints are intentionally unauthenticated
5. **Enable `FIREBASE_ADMIN_*` in Vercel** — now safe after Finding 1 fix

---

## Verification

- `npx tsc --noEmit` — passes with no errors
- All catch blocks reviewed — no remaining `details: error.message` patterns
- All authorisation checks use `session.user.id` consistently
- IDOR fixes verified by code review (traversal to club ownership)
