# FIX TASK — CourtControlAI production readiness

## ROLE
You are Qwen2.5-7B operating as a code-fixing agent with access ONLY to a local
LLM endpoint. You read source files, edit them, and report. You have no browser
tools in this task.

## ENVIRONMENT
- Project: /Users/ozguryel/Documents/Personal Projects/CourtControlAI/courtcontrolai-firebase
- Stack: Next.js 15 App Router, Firebase (client SDK), TypeScript, Tailwind
- Dev server: already running on http://127.0.0.1:9002 (DO NOT start or restart it)
- E2E suite: `npx playwright test` in the project root (60 tests in e2e/*.spec.ts)
- UI language: Turkish (primary), English (secondary)

## ROOT CAUSE ANALYSIS — already established, do not re-derive

The single highest-impact defect: **every /dashboard route renders a completely
blank page for an unauthenticated or unconfigured user.**

Chain of evidence:
1. `src/firebase/auth/use-user.tsx` (lines 13-16): when the auth context is
   unavailable it runs an offline fallback and calls `setUser(null)` +
   `setLoading(false)`.
2. `src/app/dashboard/layout.tsx` line 89: `if (!user) return null;`
   → React renders NOTHING. No spinner, no message, no redirect.
3. A repo-wide search for `router.push('/login')` / `redirect('/login')`
   returned ZERO matches. No unauthenticated redirect exists anywhere.
4. `layout.tsx` lines 80-87 render a "Syncing Console..." spinner only while
   `authLoading` is true. Once loading flips false with a null user, the
   spinner is replaced by nothing at all.

Net effect: a user who opens /dashboard (or any of its 15 child routes) sees
a white screen with zero explanation and zero way forward. The URL still says
/dashboard, so they may believe the app is broken.

## REQUIRED FIXES — implement in this order

### FIX 1 (CRITICAL) — Unauthenticated users must be sent to /login
In `src/app/dashboard/layout.tsx`, replace the bare `if (!user) return null;`
with a redirect to `/login`. Use `useEffect` + `useRouter` (already imported:
`useRouter` is imported at line 62) so the redirect happens client-side without
a flash. Keep a small visible "Redirecting to login..." state during the
transition instead of rendering null, so the user never sees a white screen.

Do NOT use `redirect()` from next/navigation in a client component.

### FIX 2 (CRITICAL) — /api/health must stop reporting a false alarm
Live probe: `GET /api/health` returns HTTP 503 with
`"env":{"ok":false,"error":"NEXT_PUBLIC_FIREBASE_API_KEY missing or placeholder;
NEXT_PUBLIC_FIREBASE_PROJECT_ID missing or placeholder; NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
missing or placeholder","firebase_configured":false,"ai_key_configured":false}`

Cause: `.env.local` has all Firebase and Google GenAI keys COMMENTED OUT
(lines beginning with `# NEXT_PUBLIC_...`). The keys are hardcoded in
`src/firebase/config.ts` instead. So the health check only inspects
`process.env` and reports "missing" even though the app actually works
through the hardcoded config.

Read `src/firebase/config.ts` and `src/app/api/health/route.ts`. Make the
env check aware of the fallback config: if `process.env` is unset but the
hardcoded config supplies a valid value, report `ok: true` and do not label it
"missing or placeholder". Only report a genuine failure when NEITHER source
has a usable value. Keep the 503 behaviour for genuinely unconfigured
deployments — just stop false-positiving on the local/hardcoded path.

Also: `checks.process.ok` is currently `false` on a healthy dev server
(rss_mb 4171 > threshold). Verify the threshold and only flag the process as
unhealthy when it is genuinely unhealthy.

### FIX 3 (HIGH) — /api/firestore/users must not 500
Live probe: `GET /api/firestore/users` → HTTP 500,
body `{"error":"Proxy error","message":"fetch failed"}`

Read `src/app/api/firestore/[...path]/route.ts`. When the upstream Firebase
call fails, the route must return a structured, non-500 error that names the
failure (e.g. 502 Bad Gateway with `{error, message, path}`) instead of
leaking a raw "fetch failed" 500. Never return an unhandled exception, and
never echo credentials or the upstream URL containing keys.

### FIX 4 (HIGH) — Firestore 500s on public tournament pages
Live probe: `/tournaments/1/bracket` renders correctly BUT logs
`Failed to load resource: the server responded with a status of 500` from the
Firestore proxy. The page has a graceful empty state, so the user is not
blocked, but the console is noisy and the same proxy breaks any page that
depends on it.

After FIX 3 improves the proxy error path, verify the bracket page still shows
its empty state. Do not change the empty-state UI.

### FIX 5 (HIGH) — /api/scheduler/solve must not 500 on a config error
Live probe: `POST /api/scheduler/solve` with
`{"tournamentId":"e2e-nonexistent-tournament","marginMinutes":30}` returns
HTTP 500 with `{"error":"firestore_read_failed","detail":"\"projectId\" not provided in firebase.initializeApp."}`

Read `src/app/api/scheduler/solve/route.ts`. The Firestore read throws, the
error propagates as an unhandled 500, and the raw SDK message is echoed to the
client. Requirements:
- A Firebase initialisation failure is a CONFIGURATION problem → return 503
  (Service Unavailable), not 500, and never echo the raw SDK detail.
- Wrap the Firestore read in try/catch and return a structured error body
  `{ error, message }` where `message` is a safe, human-readable string.
- Preserve the existing success shape so the OR-Tools bridge keeps working.

### FIX 6 (HIGH) — /api/telegram/send must fail closed with 4xx
Live probe: `POST /api/telegram/send` with
`{"chatId":"@e2e_channel","message":"probe"}` returns HTTP 500 with
`{"ok":false,"error":"Telegram bot token tanimli degil (TELEGRAM_BOT_TOKEN env veya club.telegramBotToken)"}`

A missing credential is a client/operator configuration problem. It must NOT be
a 500. Return 400 (bad request, no usable bot configured) or 503
(service not configured) — the existing 400 for missing `chatId`/`message` is
already correct, so keep that behaviour and add a proper status for the
missing-token branch. Never leak the token value if one is partially present.

### FIX 7 (MEDIUM) — Add a not-found page with a way back
Live probe: `GET /nonexistent-route-xyz` returns 404 with Next.js's built-in
page, which contains ZERO links. A user who mistypes a URL or follows a stale
bookmark lands on a dead end with no navigation.

Create `src/app/not-found.tsx`. It must be a "use client" component, match the
app's visual language (dark theme, Tailwind, existing UI primitives such as
Button), be localised for Turkish first, explain in one sentence that the page
does not exist, and offer a clear link back to `/` (and ideally `/tournaments`).
Do not add new dependencies. Keep it small and self-contained.

## HARD CONSTRAINTS
- Change ONLY these files:
  - src/app/dashboard/layout.tsx
  - src/app/api/health/route.ts
  - src/app/api/firestore/[...path]/route.ts
  - src/app/api/scheduler/solve/route.ts
  - src/app/api/telegram/send/route.ts
  - src/app/not-found.tsx   (NEW — only for FIX 7)
  - src/firebase/config.ts  (read-only unless strictly required — explain why)
- Do NOT add dependencies, do NOT modify e2e/*.
- Do NOT touch existing turkish/English UI strings in the i18n dictionaries.
- Do NOT restart or kill the dev server on :9002.
- Preserve the existing offline-tolerant auth pattern (null returns, not throws).
- TypeScript must stay clean: no `any` that was not already there.
- Every error path must return a JSON body, never an HTML error page.

## VERIFICATION — you must actually run these, not assume
1. `npx tsc --noEmit` → must be clean.
2. `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:9002/dashboard`
   → still 200, and the page must now contain a redirect mechanism.
3. `curl -s http://127.0.0.1:9002/api/health | head -c 400`
   → env check should no longer claim the hardcoded-config keys are missing.
4. `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:9002/api/firestore/users`
   → must NOT be 500.
5. `curl -s -X POST http://127.0.0.1:9002/api/scheduler/solve -H "Content-Type: application/json" -d '{"tournamentId":"e2e-nonexistent-tournament","marginMinutes":30}'`
   → must be 200/400/404/503, must NOT be 500, body must be JSON.
6. `curl -s -X POST http://127.0.0.1:9002/api/telegram/send -H "Content-Type: application/json" -d '{"chatId":"@e2e_channel","message":"probe"}'`
   → must be 4xx, must NOT be 500.
7. `curl -s http://127.0.0.1:9002/nonexistent-route-xyz | grep -c "href"`
   → must be > 0 (the new not-found page links home).
8. `npx playwright test --reporter=line` → paste the summary. Expected after
   your fixes: the 15 C-category dashboard tests still FAIL until a real user
   is authenticated, which is correct and NOT something you should fake. All
   other tests must pass.

The dev server has hot reload, so after each edit, re-run the curl checks
(allow ~3s for recompile).

## REPORT FORMAT
For each fix: what you changed (file + line range), the diff intent in one
sentence, and the actual verification output you observed.
Then list anything you could NOT fix and why.
Do not claim success without pasting real command output.
