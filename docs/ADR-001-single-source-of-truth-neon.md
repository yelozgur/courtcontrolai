# ADR-001 — Neon/Postgres is the single source of truth

**Status:** Accepted
**Date:** 2026-10-07
**Decided by:** Özgür Yel (project owner)
**Supersedes:** the implicit half-migration left in place by Week 2

---

## Context

The application currently has **two independent data stores**, and no component says which
one is authoritative for any given piece of data.

### Store 1 — Firestore (what the UI actually uses)

15 collections, confirmed by enumerating every `match` path in `firestore.rules`:

```
brackets  categories  checkins  clubs  courts  marketing_queue  matches
participants  promocodes  ratings  registrations  sponsors  tournaments  users
```

**28 UI files** import and use the Firestore SDK directly
(`useFilteredCollection`, `useCollection`, `setDoc`, `addDoc`). They read and write from the
browser. This is where all real data lives.

### Store 2 — Neon/Postgres (what the server API uses)

`prisma/schema.prisma` defines 10 models:

```
Club  Team  Tournament  Match  Bracket  AIQueue
User  Account  Session  VerificationToken
```

Of these, the REST API actually touches **5**: `club`, `tournament`, `team`, `match`, `bracket`.
`User`/`Account`/`Session`/`VerificationToken` are NextAuth's — that is all the
`PrismaAdapter` bridge was ever going to populate. NextAuth stores **auth**, not domain data.

The tables were created on 2026-10-07 via a `prisma db push` in the Vercel build. They are
**empty**.

### The gap

9 Firestore collections have **no Postgres model at all**:

```
participants  registrations  categories  courts  checkins
sponsors  promocodes  ratings  marketing_queue
```

So the migration is not "finish wiring up what exists". It is model 9 missing domains and
rewrite 28 UI files.

### Why this surfaced now

A user created a tournament through the wizard. It was written to Firestore correctly
(doc `El4cckiYaKW6Ni9AlEUN`, `status: registration_open`). It was invisible in the UI for an
unrelated reason (SEL-55, club resolution).

But it is **also invisible to every REST endpoint**, permanently:
`GET /api/tournaments` returns `[]` — not a bug, just a different database. A half-migrated
system where two stores disagree is worse than either end state, because every question
about a given record has two possible answers and only one of them is tested.

## Decision

**Neon/Postgres becomes the only system of record.** Firestore is retired once the migration
completes.

Auth already points the right way: NextAuth sessions live in Postgres via `PrismaAdapter`,
and `firestore.rules` depends on `request.auth.uid`, which disappears with Firestore. Keeping
Firestore means keeping the Firebase client SDK, the Firebase Auth bridge, and the rules
engine — three dependencies to defend an app that will read and write one Postgres schema.

## Consequences

### Accepted costs

- Real work across four phases (`DATA_MIGRATION_PLAN.md`).
- Every UI page changes its data source. This is not optional and not parallelisable.
- Firestore must keep working until each phase lands, so the two stores coexist during the
  migration by design, not by accident.

### What stops being true

- `GET /api/*` returning empty stops being expected.
- No component may write to Firestore after its phase lands. Reads follow one phase later.

### What becomes true

- One place to enforce validation, tenancy, and authorisation.
- `firestore.rules` — currently `allow read: if true` on nine collections — stops being a
  standing exposure once the rules engine is gone.
- Playwright and the E2E walk can drive real flows without a browser-side SDK.

## Non-goals

- Backfilling historical Firestore data. Current contents are 2 clubs and 4 tournaments, all
  named `deneme` / `deneme 2` — disposable test data. A Firestore export is taken first so
  the option stays open; nothing is deleted without explicit approval.
- Changing the domain model. `schema.prisma` as written is the target; missing models are
  added to match what the app already does, not to redesign it.

## Enforcement

Phase boundaries are mechanical, not judgement calls: **a page is migrated when every read
and write it performs goes through `/api/*`.** No page may mix the two stores. If a page
needs a model that does not exist yet, that model is added — the page is not left half-wired.

`grep -rl "useFilteredCollection\|useCollection\|setDoc\|addDoc" src/app src/components`
must return 0 before Firestore is deleted.
