# Data Migration Plan — Firestore to Neon/Postgres

**Date:** 2026-10-07
**Decision:** [ADR-001](ADR-001-single-source-of-truth-neon.md)
**Status:** Phase 1 starting

---

## The rule

One page is migrated when **every read and write it performs goes through `/api/*`**. No page
mixes the two stores. A page that needs a model which does not exist yet gets the model
added — it is never left half-wired.

Firestore keeps working until the phase that owns it lands. Coexistence during migration is
the plan, not an accident.

## Where the surface actually is

28 UI files currently touch the Firestore SDK. Counts are reads/writes per collection, taken
from the source:

```
matches 12   tournaments 9   participants 8   sponsors 3   clubs 3
ratings 2    promocodes 2    checkins 2
```

Collections with **no** Postgres model today:

```
participants  registrations  categories  courts  checkins
sponsors  promocodes  ratings  marketing_queue
```

Models that exist and are already wired to an endpoint: `Club`, `Tournament`, `Team`,
`Match`, `Bracket`.

---

## Phase 0 — foundation (complete)

| Item | State |
|---|---|
| Neon connection, Prisma 7 driver adapter | Done (`8d6e53c`) |
| `prisma.config.ts` | Done (`a07078b`), shadow-DB landmine removed |
| NextAuth `PrismaAdapter` bridge | Done |
| REST API skeleton: 6 endpoints | Done (`024cf62`) |
| Tables on Neon | Done, via `prisma db push` in the Vercel build |
| Deploy live, all endpoints answering 200 | Done |

## Phase 1 — the onboarding spine

**Goal:** a club can be created, a tournament built, players registered, and check-in run —
entirely server-side. This is the flow the E2E walk (SEL-38) exercises and the flow a
customer will be shown.

**Models to add:** `Participant`, `Registration`, `Category`, `Court`, `CheckIn`.

**Endpoints to build:** create/update/delete for clubs and tournaments; reads for
participants, registrations, categories, courts, check-ins.

**Pages in scope:** `/dashboard/club`, `/dashboard/participants`, `/dashboard/tournaments`,
`/dashboard/tournaments/new`, `/tournaments/new`, `/dashboard/check-in`,
`/tournaments/[id]/check-in`, `/tournaments/[id]/register`.

**Exit criteria**

- A club and a tournament are created over HTTP with no Firestore SDK in the request path.
- SEL-38's 7-step walk passes on production, reported per step with real request/response.
- SEL-55's symptom is gone **as a side effect** — the arbitrary-club fallback dies with the
  Firestore `clubs` collection, so it does not need a separate fix.

## Phase 2 — running a competition

**Goal:** matches, bracket progression, standings and results are computed server-side.

**Models:** `Match` and `Bracket` exist; wire reads/writes. Add anything the real data
requires (score fields, tie-break metadata).

**Pages in scope:** `/dashboard/schedule`, `/tournaments/[id]/bracket`,
`/tournaments/[id]/leaderboard`, `/tournaments/[id]/results`, `/referee`.

**Exit criteria:** a full tournament can be played to completion and standings reflect it,
with the OR-Tools scheduler already reachable at `SCHEDULER_URL`.

## Phase 3 — the commercial side

**Models to add:** `Sponsor`, `PromoCode`, `Rating`, `MarketingQueue`.

**Pages in scope:** `/dashboard/sponsors`, `/sponsors`, `/dashboard/admin/marketing`,
`/dashboard/profile`.

**Exit criteria:** sponsor and promo-code flows work server-side; the marketing bot's queue
moves off the Firestore collection it currently polls.

## Phase 4 — retire Firestore

**Preconditions:** the grep below returns 0.

```
grep -rl "useFilteredCollection\|useCollection\|setDoc\|addDoc" src/app src/components
```

**Remove:** `src/firebase/`, `firestore.rules`, the Firebase Auth bridge in
`src/lib/auth.ts`, Firebase env vars from Vercel, `NEXT_PUBLIC_FIREBASE_*`.

**Also remove:** the temporary `prisma db push` step in `vercel.json`. It has been necessary
only because the tables had to be created from a network that could reach Neon. Once
migrations are checked in and applied deliberately, a build should never mutate schema.

**Keep:** `USER`, `ACCOUNT`, `SESSION`, `VERIFICATIONTOKEN` — NextAuth needs them.

---

## Existing data

Firestore holds 2 clubs and 4 tournaments, named `deneme` / `deneme 2`. This is disposable
test data and is **not** backfilled.

A Firestore export is taken before anything is deleted, so the option to backfill stays open.
**Nothing is deleted without explicit approval.**

## Known defects this migration resolves for free

- **SEL-55** — `useUserClub` falls back to `allClubs[0]`, silently assigning a user to a club
  they do not own. Dies with the Firestore `clubs` collection. Not being fixed separately.
- **Client-side filtering** — `useFilteredCollection` exists as a "workaround for the
  emulator WHERE bug" and filters tournaments in JavaScript after fetching the collection.
  Replaced by real server-side queries.
- **`allow read: if true`** — nine Firestore collections are world-readable today, including
  `registrations`. Stops existing when the rules engine goes.

## Risk

The real risk is not technical, it is stopping halfway. Two stores disagreeing is the
failure mode we are trying to leave, and it is easier to stay in than to leave — every phase
looks like it works on its own. The exit criteria above are per-phase and checkable; treat
them as the definition of done rather than the code appearing to work.
