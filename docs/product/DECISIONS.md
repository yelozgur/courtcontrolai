# Product Decisions

**Author:** dispatcher (PM, agent `b5157921-b5a5-472e-b5d8-32d8e801db2e`)
**Date:** 2026-10-08
**Branch:** `fix/sel57-test-auth-provider`
**Scope:** four product gaps the orchestrator surfaced and the prior four
PM runs deferred. Each section answers exactly one question. Each
recommendation is the smallest reversible move I can defend, not a bet.

**Rules of engagement (re-stated so a future reader cannot misread this document):**

- This document does NOT write code. Implementation is handed to code-team.
- Customer-facing copy is written in Turkish. Technical reasoning is English.
- Where a decision depends on user research I do not have, I say so and mark
  it `[UNVERIFIED]` rather than invent insight.
- A `[VERIFIED]` marker means I personally opened the file/line at the path
  cited and saw what I claim I saw.
- The cost of being wrong is named for every recommendation. Reversibility
  is named for every first step.

---

## 1. `Category.matchMinutes` — real config or decoration?

**Question:** Is the per-category match duration in the schema a setting the
club can rely on, or is it decoration the UI should not expose?

**Recommendation:** Real configuration. Wire `m.category?.matchMinutes ?? 60`
into the solver payload at `src/app/api/scheduler/solve/route.ts:212`. The
field is documented in the schema, surfaced (or about to be surfaced) in
the Category UI, and silently dropped in the only consumer that reads it.
Leaving it as decoration means the UI lies to the operator about the
tournament they are scheduling. Plumbing it through is a 3-line change.

**Why this answer — cost of being wrong:**

- If we keep it as decoration: a club president enters "U18 maçları 45 dk",
  sees 45 in the UI, runs the scheduler, and gets a 60-minute schedule on
  every match. The arena TV then books 19:00–20:00 for matches that finish
  at 19:45. Real bookings collapse. The first time this happens on a club
  night, the trust loss is permanent; we will not get a second chance to
  explain "oh that field doesn't do anything yet".
- If we make it real but ignore the re-solve question: a club that already
  saved a 60-minute schedule and then lowers the category to 45 will see the
  next solve come back at 45 but the persisted `Match.scheduledAt` rows will
  already exist from the prior solve. I checked: the current `/solve` route
  returns the OR-Tools result but does NOT write to `Match.scheduledAt`
  (`route.ts:230–267` shows no `prisma.match.update`). The proposed step is
  a preview, not a commit. The re-solve question therefore does not exist
  yet — it will exist once `/solve` starts persisting. That is a separate
  decision, not this one. I am only answering the "is it real" question.

**What I verified in the repository:**

- `[VERIFIED]` Field exists with sensible default.
  `prisma/schema.prisma:154` — `matchMinutes Int @default(60)` on `Category`.
- `[VERIFIED]` Solver ignores it.
  `src/app/api/scheduler/solve/route.ts:212` — `duration_minutes: 60, // Phase 1: per-round duration; default 60 until then`.
- `[VERIFIED]` Match→Category join is available to plumb it.
  `prisma/schema.prisma:181` — `Match.categoryId String?`, `prisma/schema.prisma:200` — `category Category? @relation(...)`.
  Currently the solver's `Match.findMany` select at `route.ts:148–153` does
  NOT include `categoryId`; that select must be widened in the same PR.
- `[VERIFIED]` Re-solve does not persist today.
  `src/app/api/scheduler/solve/route.ts:230–267` — calls `/schedule`, returns
  the JSON, never calls `prisma.match.update`.
- `[UNVERIFIED]` Whether any UI today actually renders `Category.matchMinutes`
  for editing. I did not exhaustively grep the dashboard forms. If the UI
  does not render it, "make it real in the solver" is still correct, but the
  customer never asked. Worth checking before claiming a customer impact.

**What remains undecided for the human:**

- Whether the `matchMinutes` change should also be the trigger to schedule
  match-buffer (transition time) between matches on the same court. Right now
  the solver accepts `margin_minutes` from the caller (`route.ts:218`); the
  category's match duration does not influence it. Out of scope here, but
  flag it.
- Whether the customer-visible label should read "Maç Süresi" (Match
  Duration) or "Set Başına Dakika" (Minutes per Set) — padel and tennis
  clubs may parse these differently. I do not have the customer research
  to choose.

**Smallest reversible first step:**

- A code-team PR that does three things, in one commit:
  1. Widen `Match.findMany` select at `route.ts:148–153` to include
     `category: { select: { matchMinutes: true } }`.
  2. Replace `duration_minutes: 60` at `route.ts:212` with
     `duration_minutes: m.category?.matchMinutes ?? 60`.
  3. Drop the comment `// Phase 1: per-round duration; default 60 until then`
     or rewrite it to point at `Category.matchMinutes`.
- Reversibility: revert the commit. No migration, no data loss, no
  customer-visible behaviour change other than "the schedule now matches
  what the UI says". A 5-minute revert if it breaks anything.

---

## 2. Bracket type — single-elim, double-elim, round-robin, or none of those?

**Question:** Which bracket format does the product ship with, given that
the schema accepts only opaque `Bracket.data Json` and the code generator
accepts only `"Single Elimination"`?

**Recommendation:** Single-elimination only, explicitly and on the box.
Do NOT promise double-elimination or round-robin anywhere in the UI or
copy. Document the choice in the activation onboarding so a club president
is not surprised when they ask "can we do groups?".

**Why this answer — cost of being wrong:**

- The orchestrator observed (and I re-confirmed) that the bracket flow used
  to accept `"Double Elimination"` in the input and silently fall back to
  single-elimination. The schema has since been narrowed to
  `z.literal('Single Elimination').default('Single Elimination')` —
  `src/ai/flows/bracket-flow.ts:34` — which now rejects the wrong request
  with a parse error rather than producing the wrong bracket. That is the
  right shape. Preserving it means we never again ship a "we said we'd give
  you double-elimination and you got single-elimination" defect.
- For the customer profile (Turkish / padel / tennis club nights — see
  `docs/marketing/positioning-tr.md:24`), single-elimination is the
  dominant format. A padel tournament at a club with 16 players on a
  Tuesday evening is almost always a one-night SE; nobody asks for losers'
  brackets at that scale.
- If we instead tried to ship all three in one go: round-robin scheduling
  is a real product (every player plays every other player, group stage +
  knockout), it has a different match generator, a different schedule
  shape, a different "make it fair" algorithm (Berger tables), and it
  surfaces in the customer UI as a completely different set of inputs. A
  minimum viable round-robin (no Berger tables, just round-robin + final)
  is on the order of 1 engineer-week. Worth it only if a paying club
  explicitly asks. It has not.

**What I verified in the repository:**

- `[VERIFIED]` No bracket type enum in the schema.
  `grep -rn "singleElim\|doubleElim\|bracketType" . --exclude-dir=node_modules`
  → zero results. The `Bracket` model is opaque JSON:
  `prisma/schema.prisma:213` — `data Json // bracket tree structure`.
- `[VERIFIED]` Single-elimination is the only accepted input.
  `src/ai/flows/bracket-flow.ts:34` — `format: z.literal('Single Elimination').default('Single Elimination')`.
  The file header at `bracket-flow.ts:1–18` documents the prior silent
  fallback and the rationale for narrowing it.
- `[VERIFIED]` The comment at `bracket-flow.ts:13` references "round-robin"
  in the multi-day *day assignment* logic, but no round-robin *bracket
  format* is implemented. Different concept; do not conflate.
- `[VERIFIED]` The customer-facing UI exposes "Bracket Oluştur" with no
  format selector. `src/app/dashboard/schedule/page.tsx:546` —
  `{t('schedule.generateBracket')}` triggers `handleGenerateBracket`,
  which calls `generateTournamentBracket` with the default format. There
  is no format picker today.
- `[UNVERIFIED]` Whether any paying club has actually asked for double-elim
  or round-robin. I have no sales call logs. The marketing team's customer
  profile (`docs/marketing/positioning-tr.md`) does not mention either.

**What remains undecided for the human:**

- Whether the bracket format picker should be removed entirely from the UI
  (current state is "not present", which is fine) or added with a single
  locked option "Single Elimination" so the customer sees the choice
  named. I lean toward leaving it absent — naming a single option is just
  visual noise — but the marketing team may disagree for transparency
  reasons. Their call.
- Whether a future round-robin product would be a separate pricing tier
  (e.g. "League" vs "Knockout") or a single add-on. This is a product-
  packaging question I cannot answer from inside the codebase.

**Smallest reversible first step:**

- No code change. Document the choice in the activation onboarding
  (decision 4) so a club president who Googles "double elimination bracket"
  and asks "do you support this?" gets an honest answer from the operator,
  not silence from the UI.
- If the team later decides to add round-robin, the smallest reversible
  step is: add `format: z.union([z.literal('Single Elimination'), z.literal('Round Robin')])`
  to `bracket-flow.ts:34`, branch on `format` inside
  `generateTournamentBracket`, and write the SE-only branch first as the
  control. That is a 3-PR sequence with each commit independently
  revertable.

---

## 3. Money — paid SaaS, per-registration payment, or free?

**Question:** Is this product sold, or is it free, and where does the
"Total Due Today" UI fit in?

**Recommendation:** **Free for now.** Specifically free for the UNDP
Cyprus pilot and any Turkish club onboarded during the pilot. Defer all
payment integration until there is a named paying club and a named
country/jurisdiction where that club can pay.

The "Total Due Today" UI on `src/app/tournaments/[id]/register/page.tsx:272`
must be removed or replaced with "Pilot süresince kayıt ücretsizdir"
(Registration is free during the pilot). Shipping a checkout screen that
every visitor sees charging $0 with no payment processor is a credibility
liability bigger than "no checkout at all".

**Why this answer — cost of being wrong:**

- If we build Stripe today: Stripe is US-only by default, the customer is
  Turkish / Cypriot (UNDP pilot), and `iyzico` is the local processor
  (`grep -rn "iyzico" . --exclude-dir=node_modules` → zero). Building
  Stripe adds a dependency, a webhook, a refund flow, a tax line, a
  PCI scope decision. None of those have a customer yet. We would be
  paying engineering cost for a zero-revenue feature. The wrong direction.
- If we build iyzico today: same dependency cost, and the UNDP pilot is
  grant-funded — the club does not pay, the players do not pay. There is
  no payer in the loop. Wrong again.
- If we leave the "Total Due Today" UI as-is and silently mark every
  registration `waived` (current behaviour — see
  `src/app/tournaments/[id]/register/page.tsx:89` and
  `prisma/schema.prisma:91`): the customer sees a checkout screen that
  advertises a price and never collects it. They will believe the product
  is broken or, worse, that the listed price is somehow deceptive. This is
  the present state. It is worse than either build path because it is build
  cost already paid (the schema, the UI) with zero trust to show for it.
- If we mark the product "free, forever": too strong. We may want to
  charge later for league-format clients or for clubs above a size
  threshold. "Free during the pilot" preserves the optionality.

**What I verified in the repository:**

- `[VERIFIED]` No payment integration in source or dependencies.
  `grep -rn "stripe\|iyzico\|paypal" . --include="*.ts" --include="*.tsx" --include="*.json" --exclude-dir=node_modules`
  → zero results outside `node_modules/next/dist/server/capsize-font-metrics.json`
  (font name "Alumni Sans Pinstripe"; irrelevant).
- `[VERIFIED]` The schema is set up for payment but inert.
  `prisma/schema.prisma:91–92` — `paymentStatus String @default("waived")`,
  `paidAmount Decimal @default(0)`.
- `[VERIFIED]` The registration page produces a `waived` payment status
  unconditionally.
  `src/app/tournaments/[id]/register/page.tsx:89` —
  `paymentStatus: entryFee > 0 ? "paid" : "waived"`.
  Note: this is **fraud** as written — if `entryFee > 0`, the registration
  is marked `paid` with no actual charge. There is no gateway. This is a
  correctness defect today even ignoring the product question.
- `[VERIFIED]` The customer sees "Total Due Today" with a dollar amount.
  `src/app/tournaments/[id]/register/page.tsx:272` — `<span>Total Due Today</span>`,
  preceded by `<CreditCard />` icon at line 263. The checkout is decorative.
- `[VERIFIED]` No `Tournament.entryFee` enforcement on the dashboard either;
  the registration form is the only place that reads it.
  `grep -rn "entryFee" src/` returns the schema field plus the registration
  page only.
- `[VERIFIED]` Marketing analysis confirms Cyprus / UNDP pilot context.
  `docs/marketing/positioning-tr.md:3` — *"Hedef Kitle: Kıbrıs Pilot Projesi (UNDP) ve Türkiye Spor Kulübü Yöneticileri"*.

**What remains undecided for the human:**

- Whether the eventual business model is paid SaaS (club subscription),
  per-registration (player pays), or per-tournament (organizer pays). This
  is the orchestrator's exact question and I am declining to answer it
  because I do not have the customer signal. The answer determines which
  integration gets built and in what order. **The human must answer this
  before any payment code is written.** My recommendation is "free during
  pilot" precisely to push the answer forward, not to assume it.
- Whether the customer-facing copy should be "Pilot süresince ücretsiz"
  or "Şu an ücretsiz" (free right now). Different implied commitment. I
  lean toward the first (honest about the pilot framing), but the
  marketing team owns customer copy.

**Smallest reversible first step:**

- A code-team PR that does two things, in one commit:
  1. Replace the "Total Due Today" / `<CreditCard />` checkout block at
     `src/app/tournaments/[id]/register/page.tsx:259–290` with a single
     neutral confirmation block: "Pilot süresince kayıt ücretsizdir —
     ödeme adımı yok." / "Registration is free during the pilot — no
     checkout."
  2. Change `src/app/tournaments/[id]/register/page.tsx:89` from
     `paymentStatus: entryFee > 0 ? "paid" : "waived"` to
     `paymentStatus: "waived"` (the fraud fix; the new UI never advertises
     a fee).
- Reversibility: revert the commit. The schema stays, the data stays, no
  payment integration ever existed. Zero customer-visible cost if reverted.

---

## 4. Activation — what is the single moment a club owner should reach?

**Question:** What is the smallest "aha" path from "I run Tuesday-evening
leagues" to "my bracket is on screen", and what is the one Turkish-language
landing the operator must see first?

**Recommendation:** The single moment a club owner should reach is
**"I see my first bracket on the Arena TV within 90 seconds of signing
up."** The minimum path to it is:

1. Land on `/` and see the Turkish hero copy proposed by the marketing team
   (`docs/marketing/recommendation-tr.md`).
2. Click "Kulübünüzü Başlatın" → `/signup`.
3. Land on `/dashboard` and see a three-step card:
   "1. Kulübü kur  2. Oyuncuları ekle  3. Fikstürü yayınla".
4. Click step 3, generate a bracket, click "Canlı Skor Ekranı" → `/arena/[id]`.
5. See the bracket on screen. Done.

The Turkish hero copy already has a complete diff in
`docs/marketing/recommendation-tr.md:88–128`. Re-stating it here would
duplicate work; this document recommends applying that diff verbatim and
adding the three-step dashboard card as the new piece.

**Why this answer — cost of being wrong:**

- If we keep the current English hero ("Dominate Your Arena") for a Turkish
  club owner who finds the site by word of mouth from a UNDP partner: the
  bounce rate will be near 100%. The marketing team's own measurement
  (`docs/marketing/positioning-tr.md:1–16`) calls this out as the primary
  blocker. The cost of being wrong is "no pilot customer ever signs up".
- If we keep the app name as "Court Control AI" in customer-facing copy:
  the club president will not recognise it when asked "did you set up the
  Arena thing?". The marketing team's recommendation
  (`docs/marketing/positioning-tr.md:26`) is to reframe as
  "Kort ve Turnuva Yönetim Sistemi" in the hero, while keeping the legal
  product name separate. I endorse this split: do NOT rename the codebase,
  do rename the customer's mental model.
- If we skip the three-step dashboard card and just hand the operator a
  raw `/dashboard` with the existing nav: the operator will see "Schedule",
  "Venues", "Sponsors", "Check-in" and have no idea which to click first.
  E2E was green for "the page renders text" (per `e2e/TEST_RESULTS.md`
  Sprint 11 results, 69/69 pass), but that test is about page rendering,
  not about the operator reaching the moment.

**What I verified in the repository:**

- `[VERIFIED]` The landing page is fully English with hardcoded strings.
  `src/app/page.tsx:38–127` — nav links "Events", "Arena", "Sign In",
  "Register Club"; hero badge "The Multi-Tenant Sports Engine"; hero
  heading "Dominate Your Arena"; subheading "The elite sports management
  hub...". Zero Turkish characters use
  (`grep -P '[ÇĞÖŞÜİçğöşüı]' src/app/page.tsx` → zero matches).
- `[VERIFIED]` `src/i18n/I18nProvider.tsx` defaults to Turkish
  (`DEFAULT_LOCALE = 'tr'` per `translations.ts:18`), but the landing page
  does not call `useI18n`. The i18n plumbing exists and is unused on the
  pages the customer sees first.
- `[VERIFIED]` Marketing has already produced the Turkish hero copy as a
  complete diff.
  `docs/marketing/recommendation-tr.md:88–128` — a copy-paste-ready
  `diff --git` block replacing the English strings with Turkish.
  This is the smallest reversible first step for the language half of
  activation; the diff is already written.
- `[VERIFIED]` Arena live broadcast (the climax of the activation path)
  works end-to-end today.
  `docs/marketing/positioning-tr.md:71–74` documents the referee→Firestore
  →arena flow as `[VERIFIED]`. This is the actual aha moment we have.
- `[VERIFIED]` No onboarding flow exists.
  `find src/app -type d -name "*onboard*" -o -name "*getting-started*" -o -name "*welcome*"`
  → zero results. `grep -rn "onboard\|getting.started\|first.run\|first-time" src/`
  → zero results. The three-step card does not exist; we are not in
  conflict with an existing flow, we are introducing one.
- `[VERIFIED]` Dashboard layout exists and is healthy.
  `e2e/TEST_RESULTS.md:26` (FIX 1) — dashboard redirect logic was fixed and
  verified in Sprint 11. The dashboard will render correctly for a signed-in
  user; it just does not currently tell them what to do.
- `[UNVERIFIED]` Whether a club president has ever reached "my bracket is
  on screen" from a cold start via the current product. No analytics events
  for "bracket generation completed by user" or similar. We cannot
  measure whether the moment is reachable today.

**What remains undecided for the human:**

- The exact three-step card copy. I have drafted it above; the marketing
  team should own the final wording. I do not have their voice; I have
  only the constraint "must be honest about the pilot and easy to parse in
  5 seconds".
- Whether the activation metric ("bracket on screen within 90 seconds")
  should be instrumented. Without analytics, we will not know if it is
  true. **This is the gating question for the next PM cycle**: until we
  can measure activation, every subsequent PM decision is a guess.
- Whether the activation path differs for a UNDP partner (who may onboard
  many clubs at once) versus a single Turkish club president (who arrives
  alone). I suspect yes — a partner onboarding flow would skip signup and
  invite directly — but I have no partner conversation in the repo. Out of
  scope for this document.

**Smallest reversible first step:**

- Two code-team PRs, in this order:
  1. **PR 1: Apply the marketing Turkish hero diff verbatim.**
     Touches only `src/app/page.tsx`. The diff is at
     `docs/marketing/recommendation-tr.md:88–128`. Code-team should
     apply it, run `npx tsc --noEmit`, run the prod smoke suite
     (`e2e/prod-smoke.spec.ts`), and confirm P02 ("login page shows
     Turkish text") still passes. Reversible: revert the commit.
  2. **PR 2: Add the three-step activation card to `/dashboard`.**
     Touches only `src/app/dashboard/page.tsx`. Renders three cards with
     labels in Turkish:
     - "1. Kulübü kur" → `/dashboard/club`
     - "2. Oyuncuları ekle" → `/dashboard/participants`
     - "3. Fikstürü yayınla" → `/dashboard/schedule`
     Each card has a single primary CTA. Reversible: revert the commit;
     no data model change.

---

## Summary table

| # | Decision | Recommendation | First step | Reversible in |
|---|----------|----------------|------------|---------------|
| 1 | `matchMinutes` | Real config | 3-line PR at `route.ts:212` | 5 min (revert commit) |
| 2 | Bracket type | Single-elimination only, named in onboarding | No code; document in activation | N/A (docs only) |
| 3 | Payment | Free during pilot; remove checkout UI | 2-block edit at `register/page.tsx:259–290` | 5 min (revert commit) |
| 4 | Activation | "Bracket on Arena TV in 90s" | 2 PRs (Turkish hero + dashboard 3-step card) | Per-commit revert |

---

## What I am NOT deciding here

Each of these is out of scope of the four decisions above. They are real
questions the orchestrator (or the human) should answer separately:

- **Re-solve / persist semantics for `/api/scheduler/solve`** — the route
  currently returns a preview without writing `Match.scheduledAt`. Once it
  starts persisting, the "what if `matchMinutes` changes after solve"
  question becomes real. Defer until the persistence layer lands.
- **The `aiEnabled === false` toast path** in `src/app/dashboard/schedule/page.tsx`
  — the "AI Auto Schedule" button is reachable but disabled. This is a
  marketing-vs-product gap (button says one thing, reality says another).
  Resolved implicitly by PR 1 of decision 4 if the hero copy stops
  promising AI, but the dashboard button itself is a separate small fix.
- **Round-robin / double-elim** — explicitly deferred per decision 2.
  A future PM run should re-open this if a paying customer asks.
- **Multi-tenant vs single-tenant onboarding** — decision 4 covers single-
  club onboarding. Partner (UNDP) onboarding is a different product.
- **Pricing tier structure post-pilot** — gated by decision 3's "what
  remains undecided for the human" item.

---

## Lessons I will record after closing this issue

To be appended to `LESSONS.md` once the run closes successfully:

- (Lesson on evidence-first PM work): the orchestrator's claims
  (`prisma/schema.prisma:154`, `route.ts:212`, etc.) were all verifiable in
  one bash session. I did not have to take them on faith, and I did not
  have to discover new files. The pattern is: for any PM issue, verify the
  cited lines with `sed -n` before writing recommendations. Catches the
  case where the orchestrator's claim is stale or wrong.
- (Lesson on staying in lane): this run produced a 220-line markdown
  document and zero code changes. That is the correct output. The PM
  role's value is the decision and the rationale, not the patch. The
  three PRs called out as "smallest reversible first step" are all
  owned by code-team from this point.
- (Lesson on citation accuracy): on a first pass, this document cited three
  file:line references from memory and got them wrong:
  `positioning-tr.md:34` (correct: 26, where the reframing quote lives),
  `positioning-tr.md:55–63` (correct: 71–74, where the Arena Broadcast
  verification lives), `TEST_RESULTS.md:14` (correct: 26, where the FIX 1
  row lives). Caught by opening the files with `awk 'NR==N'` and reading
  the actual content. Lesson: never cite a file:line from memory; always
  re-verify with the file open. The `[VERIFIED]` markers in this document
  are only as trustworthy as the second-pass read.