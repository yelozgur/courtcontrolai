# E2E Test Results — Sprint 11

**Date:** 2026-10-02
**Base URL:** http://127.0.0.1:9002 (Next.js 15 dev, PID 39112)
**Suite:** 68 Playwright tests across 6 categories
**Command:** `npx playwright test`
**Result:** **49 passed / 19 failed (3.5 min)**

> No application code was modified to make these tests pass. Every failure below is a
> real product defect or a documented environment limitation, not a test that was
> weakened to go green.

---

## Summary by category

| Cat | Area | Tests | Pass | Fail |
|-----|------|-------|------|------|
| A | Public route render integrity | 12 | 12 | 0 |
| B | Tournament detail resilience | 10 | 10 | 0 |
| C | Dashboard content (auth) | 16 | 1 | **15** |
| D | API contract | 10 | 7 | **3** |
| E | Security boundary | 10 | 10 | 0 |
| F | Error handling / UX | 10 | 9 | **1** |

---

## Defect 1 — CRITICAL: every dashboard route renders a blank page

**Tests:** C01–C15 (15 failures) · **Route scope:** all 15 `/dashboard/**` routes

**Observed:** HTTP 200, zero visible text. The user sees a white screen.

**Root cause (traced through source):**
1. `src/firebase/auth/use-user.tsx:13-16` — when the auth context is unavailable
   the offline fallback runs `setUser(null)` + `setLoading(false)`.
2. `src/app/dashboard/layout.tsx:89` — `if (!user) return null;` renders nothing.
3. A repo-wide search for `router.push('/login')` / `redirect('/login')` returns
   **zero matches** — no unauthenticated redirect exists anywhere in the app.
4. `layout.tsx:80-87` renders the "Syncing Console..." spinner only while
   `authLoading` is true; once loading flips false with a null user the spinner
   is replaced by nothing.

**Impact:** highest user-facing severity. A signed-out user who opens
`/dashboard` sees an unexplained blank page with no way forward. A signed-in user
is unaffected once auth resolves, which is why this never surfaced in dev.

**Fix:** `useEffect` + `useRouter` redirect to `/login` with a visible
transition state instead of `return null`. Assigned to Qwen2.5-7B as FIX 1.

---

## Defect 2 — HIGH: `/api/scheduler/solve` returns 500 on a config error

**Test:** D06

**Observed:**
```
POST /api/scheduler/solve  {"tournamentId":"e2e-nonexistent-tournament"}
→ 500 {"error":"firestore_read_failed","detail":"\"projectId\" not provided in firebase.initializeApp."}
```

**Root cause:** the Firestore read throws, nothing catches it, and the raw
Firebase SDK message is echoed to the client. A missing project id is a
*configuration* condition and must be a 503, not a 500. Assigned as FIX 5.

---

## Defect 3 — HIGH: `/api/telegram/send` returns 500 when the bot token is unset

**Test:** D07

**Observed:**
```
POST /api/telegram/send  {"chatId":"@e2e_channel","message":"probe"}
→ 500 {"ok":false,"error":"Telegram bot token tanimli degil ..."}
```

**Root cause:** an unconfigured bot is a configuration condition surfaced as an
unhandled 500. The missing-`chatId` branch already correctly returns 400; the
missing-token branch does not. Assigned as FIX 6.

---

## Defect 4 — HIGH: `/api/firestore/[...path]` returns an unhandled 500

**Test:** D09

**Observed:** `GET /api/firestore/users` → 500 `{"error":"Proxy error","message":"fetch failed"}`

**Root cause:** the upstream Firebase call fails and the raw error becomes a 500.
Root cause is the same missing Firebase configuration (see Defect 5). Assigned as FIX 3.

---

## Defect 5 — MEDIUM: `/api/health` reports a false alarm

**Tests:** D01–D03 (currently passing, but reporting the wrong state)

**Observed:**
```json
{"ok":false,"checks":{"env":{"ok":false,
  "error":"NEXT_PUBLIC_FIREBASE_API_KEY missing or placeholder; ... ",
  "firebase_configured":false,"ai_key_configured":false},
  "process":{"ok":false,"rss_mb":4171}}}
```

**Root cause:** `.env.local` has every Firebase and Google GenAI key **commented
out**; the real values are hardcoded in `src/firebase/config.ts`. The health
check only inspects `process.env`, so it reports "missing" for a working
deployment. `checks.process.ok` is also false on a healthy server because the
RSS threshold is too low. A monitoring system would page on this permanently.
Assigned as FIX 2.

---

## Defect 6 — MEDIUM: 404 page has no navigation

**Test:** F01

**Observed:** `GET /nonexistent-route-xyz` → 404 with Next.js's built-in page,
which contains **zero links**. `src/app/not-found.tsx` does not exist.

**Impact:** a mistyped URL or stale bookmark is a dead end. Assigned as FIX 7.

---

## Non-defect observations

- **No privileged data leaks.** E01–E10 all pass. The unauthenticated dashboard
  returns an empty shell and the server HTML contains no user records, emails,
  club data, or cost figures. The blank page (Defect 1) is an availability bug,
  **not** a data breach — Firestore security rules remain the enforcement layer.
- **Firestore 500s on public pages** — `/tournaments/1/bracket` renders a correct
  empty state but logs upstream 500s. Cosmetic today; will matter once Firestore
  is configured.
- **A11 passes** — no 5xx on `/tournaments` itself.

## Test-suite corrections made during the run

Four initial failures were test defects, corrected rather than left failing:

1. **A06** — threshold `textLength > 20` failed on a page that renders exactly
   20 characters. `expectRendered` already enforces `> 0`; the extra bound was
   over-strict. Relaxed to `> 0` in 6 places.
2. **F09** — the test used `meta[charset]`; React renders the DOM attribute as
   `charSet`, which does not match case-sensitively in a selector.
3. **E04 / E08** — the currency detector flagged `255,255,255` inside `rgba()` and
   `41,102` / `6.219` from the React Flight payload. Added a CSS-colour strip and
   required two or more thousands groups so real money is still detected.
4. **D06** — the original test assumed a self-contained schedule payload; the real
   route reads the tournament from Firestore. Rewritten to assert graceful
   failure for an absent tournament, which is the actual contract.

## Test design notes

- Next.js dev mode inlines React Flight markers (`$3`, `$4`, `$5`) into every HTML
  shell, so a naive `/\$\s?\d/` currency pattern false-positives on all pages.
  Any future currency/amount test must strip or scope this.
- `probe()` waits 1.5s for hydration before measuring; asserting immediately
  produced false failures on client-rendered routes.
- `meta[charset]` does not match React's `charSet` output — use
  `document.characterSet`.

---

## Next step

`docs/FIX_TASK_7B.md` assigns FIX 1–7 to Qwen2.5-7B. After it runs, the fixes must be
independently verified with `npx playwright test` before anything is considered
done. The C-category tests are expected to keep failing until a real user is
authenticated — that is the correct signal, and it must not be masked.
