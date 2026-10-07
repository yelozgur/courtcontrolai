# Scheduling Model — constraints, repeat solves, and the credit gate

**Date:** 2026-10-07
**Status:** Design agreed with the owner; solver extension pending
**Supersedes:** the flat `SchedulePayload` in `app/main.py`

---

## The workflow this must model

The owner described how scheduling actually runs. Every design decision below follows
from it, because it is not a one-shot optimisation.

```
1. Registration closes
        ↓
2. Solve → a schedule on a slot grid
        ↓
3. A referee edits the grid by hand where needed        ← must survive step 4
        ↓
4. Something changes (withdrawals, venue closes) → RE-SOLVE   ← the loop
        ↓
5. Tournament day: attendance by QR code
        ↓
6. No-show → that match is skipped. Does not show to court → same.
   Both decided by referees.
        ↓
7. Want it automatic instead of manual? → costs credits.
```

Two consequences that the current solver does not model at all:

**The solve repeats.** After every manual edit and every attendance change there may be
another solve. A solver that returns a fresh full schedule each time will silently
overwrite the referee's work from step 3. That is the single most damaging failure mode
available here, and it is invisible until a referee's bracket is wrong on tournament day.

**Attendance arrives after the schedule exists.** A player marked absent has several
matches, and all of them drop out. The solver has to take an already-published schedule
plus new attendance facts and produce the next one, not start from nothing.

---

## The split that makes the credit gate honest

The owner also said manual editing is free and automation costs credits. That forces a
distinction the code currently blurs:

| | Meaning | Cost |
|---|---|---|
| **Feasibility constraints** | Physically impossible without them. One court cannot host two matches at once. A player cannot be in two places. | Free — always enforced |
| **Optimisation objectives** | Feasible either way, but *better* under optimisation. Finish early, keep waits short, avoid long days. | Metered |

This matters because a feasible schedule essentially always exists — the solver can
serialise everything onto one court. Manual editing therefore never fails; it is only
slow and unfair. **The paid value is the quality, not the feasibility.** That is exactly
what the current `minimize makespan` objective is, and it is the thing credits should buy.

If credits ever buy feasibility, the product is charging to avoid a broken schedule, and
the free manual path becomes the thing that is too hard. That is the wrong way round.

---

## Target schema

```jsonc
{
  "tournament_id": "t-001",
  "phase": "post_registration",          // post_registration | post_attendance | post_incident
  "revision": 3,                         // increments on every re-solve, for diffing

  // ── FEASIBILITY ─────────────────────────────────────────── free, always enforced
  "window": { "start": "2026-10-12T09:00:00+03:00", "end": "2026-10-12T22:00:00+03:00" },

  "venues": [
    {
      "venue_id": "v1",
      "courts": ["c1", "c2"],
      // null list = closed. Drives a forbidden-assignment constraint, not a soft penalty.
      "open_hours": { "mon": [["09:00","22:00"]], "tue": [] },
      "travel_minutes_to": { "v2": 15 }
    }
  ],

  "matches": [
    {
      "match_id": "m1",
      "player_ids": ["p1", "p2"],
      "category": "ms",
      "duration_minutes": 60,

      // ── from the referee's manual edit on the grid ──
      // Pinned to an exact court and slot. Every later solve must keep it, or the
      // whole grid shifts out from under the referee.
      "locked": { "court_id": "c1", "start_time_iso": "2026-10-12T10:30:00+03:00" },
      "locked_by": "referee:ahmet",
      "locked_at": "2026-10-07T18:02:00+03:00",

      // ── from tournament-day attendance ──
      "skipped": false,
      "skip_reason": null                 // "no_show" | "no_court_show" | "withdrawn"
    }
  ],

  "players": [
    {
      "player_id": "p1",
      // Real unavailability. Not preferences — a constraint.
      "unavailable": [
        { "from": "2026-10-12T18:00:00+03:00", "to": "2026-10-12T23:00:00+03:00" }
      ],
      "rest_minutes": 30
    }
  ],

  // ── OPTIMISATION ─────────────────────────────────────── metered, this is what credits buy
  "objectives": {
    "minimize_makespan": true,
    "minimize_max_wait_minutes": true,
    "balance_matches_per_player": true
  },

  "budget": { "max_credits": 12 }
}
```

### Fields that exist for a specific reason

- **`locked`** — the referee's grid edit. Without it, step 4 destroys step 3.
- **`skipped`** — attendance outcome. A skipped match is removed from the model but still
  reported, so the bracket shows *why* a slot is empty rather than looking like a bug.
- **`revision`** — every re-solve increments it. The UI shows a diff between revisions and
  asks before applying, because an automatic re-solve must never silently overwrite.
- **`open_hours: { "tue": [] }`** — empty means closed. An empty list and a missing key are
  different states and must not be treated the same.
- **`objectives` as a map** — each one is independently switchable and independently
  meterable, instead of one hardcoded makespan minimisation.

---

## What changes in the solver

| Change | How |
|---|---|
| `locked` | Fix `start_var` to the given slot and `court_idx_var` to the given court. The match still consumes its court interval and still respects player rest, so a bad lock surfaces as `INFEASIBLE` rather than a broken grid. |
| `skipped` | Excluded from the model; still returned in the result with its reason. |
| player `unavailable` | Forbid the match from occupying any interval that overlaps the window. |
| venue `open_hours` | Restrict court intervals to open slots via allowed assignments on the optional interval. |
| `objectives` | `minimize_max_wait_minutes` and `balance_matches_per_player` as additional terms in the objective. |
| `revision` | Echoed back; the caller diffs. |

Existing behaviour is preserved: the current four contract tests must keep passing unchanged,
including the hand-computed optimality bound of 240 minutes.

---

## The credit gate

Credits meter **automated re-solves**, not feasibility.

```
manual grid edit          → free, always available
"optimise this"           → costs credits, returns the best schedule
"re-solve after attendance" → costs credits again
```

Rationale: the loop in the workflow means re-solves recur for the whole tournament day.
Metering each one is honest — the user pays for work the club asked to be done repeatedly —
and it keeps the free manual path genuinely usable rather than a trap.

Cost should scale with effort, not be a flat fee: solve time limit, and the number of active
objectives. Two objectives over 30 matches costs more than one objective over 8.

The gate belongs in the Next.js route, not in the solver. The solver stays a pure function of
its input so it can be tested and reasoned about without a billing system in the loop.

---

## Open questions for the owner

1. **Does a locked match ever get overridden?** If a venue closes on tournament day, the
   answer cannot be "never" — the solve has to be able to report which locks it could not
   honour. Proposed: never silently override; fail with `INFEASIBLE` and name the locked
   matches, then let the referee release the lock.
2. **Who sees skipped matches?** A skipped match leaves a hole in the bracket. Proposal:
   visible with its reason, so a player can see they were recorded as absent.
3. **Is attendance per player or per match?** The description says both "no-show" and
   "does not show to court", which are different events. Proposal: attendance is per player
   per session; "no court show" is a per-match referee decision.
